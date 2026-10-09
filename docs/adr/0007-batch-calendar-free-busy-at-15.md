# Batch Google Calendar free/busy requests at 15 calendars

Google documents a 50-calendar limit per free/busy request, but in practice the API
silently drops busy data for some calendars above roughly 20, which would make
booked equipment appear available. The server therefore chunks every request into
groups of 15 (the client caps its RPC fan-out at 40) and fires the chunks in
parallel. The constant must stay below ~20; raising it toward the documented limit
reintroduces the silent drops.
