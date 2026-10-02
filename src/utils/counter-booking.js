const ApiError=require('./api-error');
async function assertLegacyBooking(conn,id) {
  const [[counter]]=await conn.query("SELECT EXISTS(SELECT 1 FROM checkout_sessions WHERE booking_id=?) OR EXISTS(SELECT 1 FROM audit_events WHERE entity_type='booking' AND entity_id=? AND action='booking.create') AS scoped",[id,id]);
  if(counter.scoped)throw new ApiError(409,'Booking uses scoped counter routes; legacy changes would bypass cash and stock safeguards');
}
module.exports={assertLegacyBooking};
