import { neon } from '@neondatabase/serverless';
let databaseUrl;
function getDatabaseUrl() {
    if (databaseUrl)
        return databaseUrl;
    const url = process.env.DATABASE_URL;
    if (!url) {
        throw new Error('DATABASE_URL is not defined on the server');
    }
    databaseUrl = url;
    return url;
}
let client = null;
function c() {
    if (!client) {
        client = neon(getDatabaseUrl());
    }
    return client;
}
function sql(strings, ...values) {
    return c()(strings, ...values);
}
sql.query = (text, params) => c().query(text, params);
sql.unsafe = (strings, ...values) => c().unsafe(strings, ...values);
sql.transaction = (fn) => c().transaction(fn);
export { sql };
export async function query(text, params = []) {
    const res = c().query(text, params);
    return res;
}
