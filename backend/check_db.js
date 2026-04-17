const db = require('./db.js');
async function checkData() {
    try {
        const [tasks] = await db.query("SELECT COUNT(*) as count FROM tasks");
        const [history] = await db.query("SELECT COUNT(*) as count FROM activity_log");
        const [finance] = await db.query("SELECT COUNT(*) as count FROM monthly_finance");
        console.log('Tasks:', tasks[0].count);
        console.log('History:', history[0].count);
        console.log('Finance:', finance[0].count);
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
checkData();
