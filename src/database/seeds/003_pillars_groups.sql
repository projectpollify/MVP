-- Update pillars with colors and icons
UPDATE pillars SET color_hex = '#E91E63', icon_name = 'heart', display_order = 1 WHERE name = 'Compassion';
UPDATE pillars SET color_hex = '#FF9800', icon_name = 'fist-raised', display_order = 2 WHERE name = 'Empowerment';
UPDATE pillars SET color_hex = '#2196F3', icon_name = 'balance-scale', display_order = 3 WHERE name = 'Justice';
UPDATE pillars SET color_hex = '#4CAF50', icon_name = 'dove', display_order = 4 WHERE name = 'Freedom';
UPDATE pillars SET color_hex = '#9C27B0', icon_name = 'hands-helping', display_order = 5 WHERE name = 'Unity';
UPDATE pillars SET color_hex = '#00BCD4', icon_name = 'music', display_order = 6 WHERE name = 'Harmony';
UPDATE pillars SET color_hex = '#FFC107', icon_name = 'sun', display_order = 7 WHERE name = 'Hope';

-- Insert default groups for each pillar
-- Compassion groups
INSERT INTO groups (pillar_id, name, description, is_default) VALUES
((SELECT id FROM pillars WHERE name = 'Compassion'), 'Helping Hands', 'Community support and mutual aid', true),
((SELECT id FROM pillars WHERE name = 'Compassion'), 'Mental Health Support', 'Safe space for mental health discussions', true),
((SELECT id FROM pillars WHERE name = 'Compassion'), 'Community Care', 'Local community initiatives and care', true);

-- Empowerment groups
INSERT INTO groups (pillar_id, name, description, is_default) VALUES
((SELECT id FROM pillars WHERE name = 'Empowerment'), 'Personal Growth', 'Self-improvement and development', true),
((SELECT id FROM pillars WHERE name = 'Empowerment'), 'Skills Development', 'Learning and sharing skills', true);

-- Justice groups
INSERT INTO groups (pillar_id, name, description, is_default) VALUES
((SELECT id FROM pillars WHERE name = 'Justice'), 'Equal Rights', 'Advocacy for equality and rights', true),
((SELECT id FROM pillars WHERE name = 'Justice'), 'Fair Systems', 'Discussing and improving systems', true);

-- Freedom groups
INSERT INTO groups (pillar_id, name, description, is_default) VALUES
((SELECT id FROM pillars WHERE name = 'Freedom'), 'Expression & Speech', 'Free expression and dialogue', true),
((SELECT id FROM pillars WHERE name = 'Freedom'), 'Personal Liberty', 'Individual freedoms and rights', true);

-- Unity groups
INSERT INTO groups (pillar_id, name, description, is_default) VALUES
((SELECT id FROM pillars WHERE name = 'Unity'), 'Building Bridges', 'Connecting communities', true),
((SELECT id FROM pillars WHERE name = 'Unity'), 'Common Ground', 'Finding shared values', true);

-- Harmony groups
INSERT INTO groups (pillar_id, name, description, is_default) VALUES
((SELECT id FROM pillars WHERE name = 'Harmony'), 'Peaceful Solutions', 'Conflict resolution and peace', true),
((SELECT id FROM pillars WHERE name = 'Harmony'), 'Cultural Exchange', 'Celebrating diversity', true);

-- Hope groups
INSERT INTO groups (pillar_id, name, description, is_default) VALUES
((SELECT id FROM pillars WHERE name = 'Hope'), 'Success Stories', 'Sharing wins and achievements', true),
((SELECT id FROM pillars WHERE name = 'Hope'), 'Future Vision', 'Building a better tomorrow', true);
