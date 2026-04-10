USE matcha_db;

-- Thêm cột last_watchdog_date vào bảng user_stats
ALTER TABLE user_stats ADD COLUMN last_watchdog_date DATE;
-- Đảm bảo có đủ các cột cho Pet và AI Roast
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS last_roast_date DATE;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS pet_state VARCHAR(50) DEFAULT 'neutral';
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS current_points INT DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS total_exp INT DEFAULT 0;
ALTER TABLE user_stats ADD COLUMN IF NOT EXISTS level INT DEFAULT 1;

-- Khởi tạo dữ liệu gốc nếu chưa có
INSERT IGNORE INTO user_stats (id) VALUES (1);
