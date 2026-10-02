const ApiError=require('../../utils/api-error');
const {minor}=require('../../utils/money');
const C=require('./counter-core');
function parseCsv(input) {
  if(typeof input!=='string'||Buffer.byteLength(input)>500000)throw new ApiError(422,'CSV must be text under 500 KB');
  const rows=[];let row=[],field='',quoted=false,closed=false;
  for(let index=0;index<input.length;index++) {
    const ch=input[index];
    if(quoted) {if(ch==='"'){if(input[index+1]==='"'){field+='"';index++;}else{quoted=false;closed=true;}}else field+=ch;}
    else if(ch==='"') {if(field||closed)throw new ApiError(422,'Malformed CSV quote');quoted=true;}
    else if(ch===','||ch==='\n'||ch==='\r') {
      row.push(field);field='';closed=false;
      if(ch!==','){if(ch==='\r'&&input[index+1]==='\n')index++;if(row.some(v=>v.length))rows.push(row);row=[];}
    } else {if(closed)throw new ApiError(422,'Unexpected text after CSV quote');field+=ch;}
  }
  if(quoted)throw new ApiError(422,'Unclosed CSV quote');
  if(field||row.length){row.push(field);if(row.some(v=>v.length))rows.push(row);}
  if(rows.length<2||rows.length>1001)throw new ApiError(422,'CSV requires a header and 1 to 1000 rows');
  return rows;
}
function cell(value) {let text=String(value ?? '');if(/^[=+\-@\t\r]/.test(text))text=`'${text}`;return `"${text.replace(/"/g,'""')}"`;}
const headers=['item_name','sku','barcode','unit_id','base_unit_code','sale_price','purchase_price','kind'];
async function validateRows(conn,ctx,rows) {
  const errors=[],normalized=[],skus=new Set(),barcodes=new Set();
  for(let i=0;i<rows.length;i++) {
    try {
      const line=rows[i];
      const sku=C.text(line.sku,'SKU',80);if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sku))throw new ApiError(422,'SKU uses letters, numbers, dot, dash or underscore');
      const barcode=C.text(line.barcode,'barcode',100);if(!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(barcode))throw new ApiError(422,'Invalid barcode');
      if(skus.has(sku.toLowerCase())||barcodes.has(barcode.toLowerCase()))throw new ApiError(422,'Duplicate SKU/barcode within import');skus.add(sku.toLowerCase());barcodes.add(barcode.toLowerCase());
      const [[exists]]=await conn.query('SELECT id FROM item_details WHERE (store_id=? AND sku=?) OR label_barcode=? LIMIT 1',[ctx.storeId,sku,barcode]);if(exists)throw new ApiError(409,'SKU/barcode already exists');
      const unit=await C.row(conn,'item_units',ctx.storeId,line.unit_id);
      const name=C.text(line.item_name,'item_name',200);C.choice(line.base_unit_code,['piece','g','kg','ml','l'],'base_unit_code');C.choice(line.kind || 'retail',['retail','bakery','ingredient'],'product kind');
      const price=minor(line.sale_price),cost=minor(line.purchase_price || '0');if(price<0||cost<0)throw new ApiError(422,'Prices must be nonnegative');
      normalized.push({name,sku,barcode,unit:unit.id,base_unit_code:line.base_unit_code,price,cost,kind:line.kind || 'retail',variant_options:line.variant_options || {}});
    } catch(e) {if(!(e instanceof ApiError))throw e;errors.push({row:i+2,message:e.message});}
  }
  return {errors,normalized};
}
async function insertVariant(conn,ctx,line,productId=null) {
  if(productId)await C.row(conn,'products',ctx.storeId,productId);
  const product=productId || await C.insert(conn,'products',{store_id:ctx.storeId,name:line.name,kind:line.kind});
  if(!line.variant_options||typeof line.variant_options!=='object'||Array.isArray(line.variant_options)||JSON.stringify(line.variant_options).length>1000)throw new ApiError(422,'Invalid variant options');
  return C.insert(conn,'item_details',{store_id:ctx.storeId,item_name:line.name,product_id:product,sku:line.sku,label_barcode:line.barcode,item_unit_id:line.unit,base_unit_code:line.base_unit_code,sale_price:C.exact.decimal(line.price),purchase_price:C.exact.decimal(line.cost),variant_options:JSON.stringify(line.variant_options)});
}
async function variant(ctx,body,key) {
  C.role(ctx,['owner','manager','inventory_clerk']);
  return C.transaction(ctx,'catalog.variant',key,body,async conn=>{
    const {errors,normalized}=await validateRows(conn,ctx,[body]);if(errors.length)throw new ApiError(422,errors[0].message);
    const value=await insertVariant(conn,ctx,normalized[0],body.product_id);
    await C.audit(conn,ctx,'catalog.variant','item',value,'Product variant created');return C.row(conn,'item_details',ctx.storeId,value);
  });
}
async function importCsv(ctx,body,key) {
  C.role(ctx,['owner','manager','inventory_clerk']);
  const csv=parseCsv(body.csv);if(csv[0].join(',')!==headers.join(','))throw new ApiError(422,`CSV header must be ${headers.join(',')}`);
  const rows=csv.slice(1).map(values=>{if(values.length!==headers.length)throw new ApiError(422,'CSV column count mismatch');return Object.fromEntries(headers.map((h,i)=>[h,values[i]]));});
  if(body.dry_run!==true&&body.dry_run!==false)throw new ApiError(422,'dry_run must be boolean');
  if(body.dry_run) {const {errors,normalized}=await validateRows(ctx.pool,ctx,rows);return {dry_run:true,rows:rows.length,valid_rows:normalized.length,errors};}
  return C.transaction(ctx,'catalog.import',key,{csv:body.csv},async conn=>{
    const {errors,normalized}=await validateRows(conn,ctx,rows);if(errors.length)throw new ApiError(422,`CSV rejected: ${JSON.stringify(errors)}`);
    const ids=[];for(const line of normalized)ids.push(await insertVariant(conn,ctx,line));
    await C.audit(conn,ctx,'catalog.import','catalog',null,'CSV imported atomically',{count:ids.length});return {imported:ids.length,ids};
  });
}
async function exportCsv(ctx) {
  C.role(ctx,['owner','manager','inventory_clerk']);
  const [rows]=await ctx.pool.query('SELECT i.item_name,i.sku,i.label_barcode AS barcode,i.item_unit_id AS unit_id,i.base_unit_code,i.sale_price,i.purchase_price,p.kind FROM item_details i LEFT JOIN products p ON p.id=i.product_id AND p.store_id=i.store_id WHERE i.store_id=? ORDER BY i.id LIMIT 10000',[ctx.storeId]);
  return `${headers.join(',')}\r\n${rows.map(r=>headers.map(h=>cell(r[h])).join(',')).join('\r\n')}\r\n`;
}
async function search(ctx,query) {
  const {page,limit,offset}=require('../../utils/pagination').getPagination(query);
  const value=String(query.search || '').trim();if(value.length>100)throw new ApiError(422,'Search too long');
  const escaped=value.replace(/[\\%_]/g,'\\$&'),like=`${escaped}%`;
  const [rows]=await ctx.pool.query('SELECT id,item_name,sku,label_barcode,sale_price,item_unit_id,base_unit_code,product_id,variant_options FROM item_details WHERE store_id=? AND is_enable=1 AND (item_name LIKE ? OR sku LIKE ? OR label_barcode=?) ORDER BY item_name,id LIMIT ? OFFSET ?',[ctx.storeId,like,like,value,limit,offset]);
  const [[count]]=await ctx.pool.query('SELECT COUNT(*) AS n FROM item_details WHERE store_id=? AND is_enable=1 AND (item_name LIKE ? OR sku LIKE ? OR label_barcode=?)',[ctx.storeId,like,like,value]);
  return {rows,meta:require('../../utils/pagination').buildMeta(page,limit,count.n)};
}
module.exports={parseCsv,cell,variant,importCsv,exportCsv,search,headers};
