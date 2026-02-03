-- Seed Categories
INSERT INTO category (name, description, sort_order) VALUES
('Cameras', 'Camera bodies', 1),
('Lenses', 'Camera lenses', 2),
('Lighting', 'Lighting equipment and accessories', 3),
('Triggers', 'Flash triggers and synchronizers', 4),
('Storage', 'Memory cards and storage devices', 5),
('Batteries', 'Camera batteries and power accessories', 6);

-- Seed Equipment
-- Note: gcal_id values need to be replaced with actual Google Calendar IDs

-- Cameras
INSERT INTO equipment (model_name, short_name, description, category_id, gcal_id, required_clearance_level) VALUES
('Nikon Z6III #1', 'Z6III', 'Nikon Z6III camera body', (SELECT id FROM category WHERE name = 'Cameras'), 'placeholder_gcal_z6iii', 1),
('Nikon Z6III #2', 'Z6III', 'Nikon Z6III camera body', (SELECT id FROM category WHERE name = 'Cameras'), 'placeholder_gcal_z6ii', 1),
('Nikon Z30', 'Z30', 'Nikon Z30 camera body', (SELECT id FROM category WHERE name = 'Cameras'), 'placeholder_gcal_z30', 1),
('Nikon Z5', 'Z5', 'Nikon Z5 camera body', (SELECT id FROM category WHERE name = 'Cameras'), 'placeholder_gcal_z5', 1);

-- Lenses
INSERT INTO equipment (model_name, short_name, description, category_id, gcal_id, required_clearance_level) VALUES
('Sigma 150-600mm F5-6.3', '150-600', 'Sigma 150-600mm F5-6.3 telephoto lens', (SELECT id FROM category WHERE name = 'Lenses'), 'placeholder_gcal_sigma_150_600', 1),
('Sigma 70-200mm F2.8', '70-200', 'Sigma 70-200mm F2.8 telephoto zoom lens', (SELECT id FROM category WHERE name = 'Lenses'), 'placeholder_gcal_sigma_70_200', 1),
('Nikkor 70-180mm F2.8', '70-180', 'Nikkor 70-180mm F2.8 telephoto zoom lens', (SELECT id FROM category WHERE name = 'Lenses'), 'placeholder_gcal_nikkor_70_180', 1),
('Nikkor 28-75mm F2.8', '28-75', 'Nikkor 28-75mm F2.8 standard zoom lens', (SELECT id FROM category WHERE name = 'Lenses'), 'placeholder_gcal_nikkor_28_75', 1),
('Nikkor 50mm F1.8', '50', 'Nikkor 50mm F1.8 prime lens', (SELECT id FROM category WHERE name = 'Lenses'), 'placeholder_gcal_nikkor_50', 1),
('Nikkor 16-50mm F3.5-6.3', '16-50', 'Nikkor 16-50mm F3.5-6.3 wide zoom lens', (SELECT id FROM category WHERE name = 'Lenses'), 'placeholder_gcal_nikkor_16_50', 1),
('Viltrox 24mm F1.8', '24', 'Viltrox 24mm F1.8 wide prime lens', (SELECT id FROM category WHERE name = 'Lenses'), 'placeholder_gcal_viltrox_24', 1);

-- Lighting Equipment
INSERT INTO equipment (model_name, short_name, description, category_id, gcal_id, required_clearance_level) VALUES
('Amaran 300C', 'Amaran', 'Amaran 300C LED light', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_amaran_300c', 1),
('Viltrox K60', 'джедайка маленькая', 'Viltrox K60 small LED panel', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_viltrox_k60', 1),
('DigitalFoto Chameleon 2 RGB', 'джедайка большая', 'DigitalFoto Chameleon 2 RGB large LED panel', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_digitalfoto_chameleon', 1),
('Godox TT350N #1', 'Вспышка', 'Godox TT350N speedlight flash (2 units)', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_godox_tt350n_1', 1),
('Godox TT350N #2', 'Вспышка', 'Godox TT350N speedlight flash unit 2', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_godox_tt350n_2', 1),
('Aputure Light Box 6090 #1', 'Софтбокс', 'Aputure Light Box 6090 softbox (2 units)', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_aputure_lightbox_1', 1),
('Aputure Light Box 6090 #2', 'Софтбокс', 'Aputure Light Box 6090 softbox unit 2', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_aputure_lightbox_2', 1),
('WinninGear M #1', 'Стойка', 'WinninGear M light stand (3 units)', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_winnin_stand_1', 1),
('WinninGear M #2', 'Стойка', 'WinninGear M light stand unit 2', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_winnin_stand_2', 1),
('WinninGear M #3', 'Стойка', 'WinninGear M light stand unit 3', (SELECT id FROM category WHERE name = 'Lighting'), 'placeholder_gcal_winnin_stand_3', 1);

-- Triggers
INSERT INTO equipment (model_name, short_name, description, category_id, gcal_id, required_clearance_level) VALUES
('Godox X2T-N #1', 'Синхронизатор', 'Godox X2T-N wireless flash trigger (2 units)', (SELECT id FROM category WHERE name = 'Triggers'), 'placeholder_gcal_godox_x2t_1', 1),
('Godox X2T-N #2', 'Синхронизатор', 'Godox X2T-N wireless flash trigger unit 2', (SELECT id FROM category WHERE name = 'Triggers'), 'placeholder_gcal_godox_x2t_2', 1);

-- Storage
INSERT INTO equipment (model_name, short_name, description, category_id, gcal_id, required_clearance_level) VALUES
('Sandisk 64 GB', 'сдшка', 'Sandisk 64GB SD card (6 total)', (SELECT id FROM category WHERE name = 'Storage'), 'placeholder_gcal_sandisk_64gb', 1);

-- Batteries
INSERT INTO equipment (model_name, short_name, description, category_id, gcal_id, required_clearance_level) VALUES
('EN-EL 15C', 'Аккум для Z6III/Z5', 'EN-EL 15C battery for Z6III/Z5 (6 total, 1 always on default with camera, spare 3)', (SELECT id FROM category WHERE name = 'Batteries'), 'placeholder_gcal_enel15c', 1),
('EN-EL 25', 'Аккум для Z30', 'EN-EL 25 battery for Z30 (2 total, 1 spare)', (SELECT id FROM category WHERE name = 'Batteries'), 'placeholder_gcal_enel25', 1);
