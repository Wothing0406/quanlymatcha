-- ==========================================================
-- MATCHA V5.0 DATABASE MIGRATION SCRIPT
-- ==========================================================
-- Chạy script này để nâng cấp cấu trúc Database từ V3/V4 lên V5.0
-- Không làm mất dữ liệu cũ, chỉ thêm cột và bảng mới.

-- 1. Cập nhật bảng monthly_finance
ALTER TABLE monthly_finance ADD COLUMN IF NOT EXISTS score INT DEFAULT 0;

-- 2. Cập nhật bảng saving_goals
ALTER TABLE saving_goals ADD COLUMN IF NOT EXISTS category VARCHAR(50) DEFAULT 'general';

-- 3. Cập nhật bảng tasks
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS points_rewarded TINYINT(1) DEFAULT 0;

-- 4. Cập nhật activity_log (Mở rộng các loại hoạt động)
ALTER TABLE activity_log MODIFY COLUMN type ENUM(
    'income', 'expense', 'saving', 
    'task_started', 'task_done', 'task_missed', 'task_postponed',
    'reward', 'penalty', 'ai_roast'
) NOT NULL;

-- 5. Tạo bảng user_stats (Chỉ số người dùng và Pet)
CREATE TABLE IF NOT EXISTS user_stats (
    id INT PRIMARY KEY DEFAULT 1,
    current_points INT DEFAULT 0,
    total_exp INT DEFAULT 0,
    level INT DEFAULT 1,
    pet_state VARCHAR(50) DEFAULT 'neutral',
    last_roast_date DATE,
    last_watchdog_date DATE,
    CHECK (id = 1)
);

-- Khởi tạo dòng dữ liệu mặc định
INSERT IGNORE INTO user_stats (id) VALUES (1);

-- 6. Tạo bảng points_history (Lịch sử điểm số)
CREATE TABLE IF NOT EXISTS points_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    amount INT,
    reason VARCHAR(255),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Hoàn tất nâng cấp! 🌿
-- Chạy lệnh 'docker compose restart' sau khi thực thi file này.
