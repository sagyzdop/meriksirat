-- Mock Booking Data for Bakhtiyar Yesbolsyn (sagyzdop@gmail.com)
-- User ID: 7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI

-- First, ensure we have category and equipment (run this if not already done)
INSERT OR IGNORE INTO category (id, name, description, sort_order, created_at, updated_at) VALUES
(1, 'Cameras', 'Professional cameras and lenses', 1, 1704067200000, 1704067200000),
(2, 'Audio Equipment', 'Microphones, recorders, and audio gear', 2, 1704067200000, 1704067200000),
(3, 'Lighting', 'Studio lights and lighting equipment', 3, 1704067200000, 1704067200000),
(4, 'Computing', 'Laptops, tablets, and computing devices', 4, 1704067200000, 1704067200000),
(5, 'Accessories', 'Tripods, cables, and other accessories', 5, 1704067200000, 1704067200000);

INSERT OR IGNORE INTO equipment (id, model_name, description, category_id, gcal_id, required_clearance_level, is_active, created_at, updated_at) VALUES
(1, 'Canon EOS R5', 'Professional mirrorless camera with 45MP sensor', 1, 'canon-eos-r5-cal@example.com', 1, 1, 1704067200000, 1704067200000),
(2, 'Sony A7 IV', 'Full-frame mirrorless camera with excellent video capabilities', 1, 'sony-a7iv-cal@example.com', 1, 1, 1704067200000, 1704067200000),
(3, 'MacBook Pro 16"', 'Apple MacBook Pro with M3 Max chip', 4, 'macbook-pro-cal@example.com', 2, 1, 1704067200000, 1704067200000),
(4, 'Rode PodMic', 'Professional broadcast dynamic microphone', 2, 'rode-podmic-cal@example.com', 1, 1, 1704067200000, 1704067200000),
(5, 'Godox SL-60W', 'LED video light with bowens mount', 3, 'godox-sl60w-cal@example.com', 1, 1, 1704067200000, 1704067200000),
(6, 'iPad Pro 12.9"', 'Apple iPad Pro with M2 chip', 4, 'ipad-pro-cal@example.com', 1, 1, 1704067200000, 1704067200000),
(7, 'Manfrotto Tripod', 'Professional carbon fiber tripod', 5, 'manfrotto-tripod-cal@example.com', 1, 1, 1704067200000, 1704067200000),
(8, 'Zoom H6', 'Handy recorder with interchangeable microphone system', 2, 'zoom-h6-cal@example.com', 1, 1, 1704067200000, 1704067200000),
(9, 'DJI Mavic 3', 'Professional drone with 4K camera', 1, 'dji-mavic3-cal@example.com', 2, 1, 1704067200000, 1704067200000),
(10, 'Shure SM7B', 'Dynamic microphone for broadcasting and recording', 2, 'shure-sm7b-cal@example.com', 1, 1, 1704067200000, 1704067200000);

-- Insert booking for Bakhtiyar Yesbolsyn
-- All booking use the same column structure: user_id, equipment_id, start_time, end_time, status, user_event_details, created_at, updated_at
INSERT INTO booking (user_id, equipment_id, start_time, end_time, status, user_event_details, created_at, updated_at) VALUES
-- Today's booking (January 29, 2025)
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 1, 1738195200000, 1738206000000, 'awaiting_pickup', 'Photography workshop for students', 1738108800000, 1738108800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 4, 1738220400000, 1738231200000, 'reserved', 'Recording podcast about tech education', 1738108800000, 1738108800000),

-- Tomorrow's booking (January 30, 2025)
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 3, 1738281600000, 1738292400000, 'reserved', 'Video editing for university project', 1738108800000, 1738108800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 5, 1738303200000, 1738314000000, 'reserved', 'Studio lighting setup for portrait session', 1738108800000, 1738108800000),

-- This week's booking
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 2, 1738454400000, 1738465200000, 'reserved', 'Event photography - tech conference', 1738108800000, 1738108800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 7, 1738540800000, 1738551600000, 'reserved', 'Outdoor photography session in Almaty', 1738108800000, 1738108800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 9, 1738627200000, 1738638000000, 'reserved', 'Aerial photography for real estate project', 1738108800000, 1738108800000),

-- Next week's booking
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 6, 1738800000000, 1738810800000, 'reserved', 'Client presentation and app demos', 1738108800000, 1738108800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 8, 1738886400000, 1738897200000, 'reserved', 'Field recording for documentary about Kazakhstan', 1738108800000, 1738108800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 10, 1738972800000, 1738983600000, 'reserved', 'Podcast recording with guest speaker', 1738108800000, 1738108800000),

-- Past booking with various statuses
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 1, 1737936000000, 1737946800000, 'returned', 'Corporate headshots for startup team', 1737849600000, 1737936000000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 3, 1737590400000, 1737601200000, 'returned', 'Video editing for client project completed', 1737504000000, 1737590400000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 2, 1737244800000, 1737255600000, 'cancelled', 'Wedding cancelled due to family emergency', 1737158400000, 1737244800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 4, 1736899200000, 1736910000000, 'overdue', 'Microphone not returned on time - contacted user', 1736812800000, 1736899200000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 5, 1736553600000, 1736564400000, 'returned', 'Studio lighting session completed successfully', 1736467200000, 1736553600000),

-- Some longer booking (multi-day projects)
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 3, 1739059200000, 1739318400000, 'reserved', 'Week-long video production for educational content', 1738108800000, 1738108800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 1, 1739404800000, 1739491200000, 'reserved', 'Weekend photography workshop instructor', 1738108800000, 1738108800000),

-- booking with different statuses for testing filters
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 6, 1738368000000, 1738378800000, 'pending_handover', 'iPad ready for pickup - client presentation prep', 1738108800000, 1738108800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 7, 1738713600000, 1738724400000, 'awaiting_pickup', 'Tripod ready for collection - outdoor shoot', 1738108800000, 1738108800000),

-- Some booking without notes (using NULL for user_event_details)
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 8, 1739145600000, 1739156400000, 'reserved', NULL, 1738108800000, 1738108800000),
('7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI', 2, 1739232000000, 1739242800000, 'reserved', NULL, 1738108800000, 1738108800000);

-- Display summary of inserted data
SELECT 'booking created for Bakhtiyar:' as summary, COUNT(*) as count 
FROM booking 
WHERE user_id = '7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI';

-- Show the booking data with equipment names for verification
SELECT 
    b.id,
    e.model_name as equipment,
    datetime(b.start_time/1000, 'unixepoch') as start_time,
    datetime(b.end_time/1000, 'unixepoch') as end_time,
    b.status,
    COALESCE(b.user_event_details, 'No notes') as notes
FROM booking b
JOIN equipment e ON b.equipment_id = e.id
WHERE b.user_id = '7pzVoyaUe0bX8Uf3R75CnzcBFO66hFUI'
ORDER BY b.start_time DESC
LIMIT 10;