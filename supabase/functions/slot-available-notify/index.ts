import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { createHandler } from './worker.mjs';
Deno.serve(async (req: Request) => {
 const db=createClient(Deno.env.get('SUPABASE_URL')??'',Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')??'');
 const got=req.headers.get('x-booking-notify-secret');
 if (!got) return Response.json({error:'forbidden'},{status:403});
 const {data:secret,error}=await db.rpc('internal_booking_notify_secret');
 if(error || !secret || got!==secret) return Response.json({error:'forbidden'},{status:403});
 return createHandler({db,secret,appId:Deno.env.get('ONESIGNAL_APP_ID'),apiKey:Deno.env.get('ONESIGNAL_REST_API_KEY')})(req);
});
