const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 3306,
    user: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || 'password',
    database: process.env.DB_DATABASE || 'rac_ai_chat',
  });

  try {
    console.log('Running database migrations...');

    // Read and execute migration files
    const migrationFiles = [
      '001-create-tables.sql',
      '002-insert-test-user.sql',
      '003-fix-error-message-column.sql'
    ];

    for (const file of migrationFiles) {
      const migrationPath = path.join(__dirname, '../src/migrations', file);
      const sql = fs.readFileSync(migrationPath, 'utf8');
      
      console.log(`Executing ${file}...`);
      await connection.execute(sql);
      console.log(`✅ ${file} completed`);
    }

    console.log('🎉 All migrations completed successfully!');
    console.log('Test user credentials:');
    console.log('Username: testuser');
    console.log('Password: password123');

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

runMigrations();
