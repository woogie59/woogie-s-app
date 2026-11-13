import React from 'react';
import {createRoot} from 'react-dom/client';
import {DesignRefinementContext} from '../../src/features/design/designRefinement';
import ClassBooking from '../../src/features/booking/ClassBooking';
import {GlobalModalProvider} from '../../src/context/GlobalModalContext';
import '../../src/index.css';
localStorage.setItem('booking_selected_date_00000000-0000-4000-8000-000000000001',JSON.stringify({ymd:'2026-11-13'}));
// Use actual existing storage helper format: a valid ISO string.
localStorage.setItem('booking_selected_date_00000000-0000-4000-8000-000000000001',new Date('2026-11-13T12:00:00+09:00').toISOString());
localStorage.setItem('booking_week_mode_00000000-0000-4000-8000-000000000001','current');
createRoot(document.getElementById('root')).render(<DesignRefinementContext.Provider value={{enabled:true}}><GlobalModalProvider><ClassBooking user={{id:'00000000-0000-4000-8000-000000000001'}} profileName="합성테스트" goBack={()=>{}} setView={()=>{}}/></GlobalModalProvider></DesignRefinementContext.Provider>);
