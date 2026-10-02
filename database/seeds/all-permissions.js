const base=require('./base-permissions');
const catalog=require('../../src/config/permission-catalog');
module.exports=[...new Map([...base,...catalog.flatMap(module=>module.permissions.map(permissionKey=>({permissionKey,module:module.code,description:`${module.module} operation`})))].map(permission=>[permission.permissionKey,permission])).values()];
