-- Insert test user
-- Password is 'password123' (hashed with bcrypt)
INSERT INTO users (id, username, email, password, name, picture) VALUES (
    'test-user-id-123',
    'testuser',
    'test@example.com',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    'Test User',
    'https://via.placeholder.com/150'
) ON DUPLICATE KEY UPDATE username = username;
