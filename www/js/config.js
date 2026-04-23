/**
 * BioSync Native App Configuration
 * This file allows the app to connect directly to the cloud without a local proxy server.
 */

window.BioSyncConfig = {
    supabaseUrl: "https://ddzbddxineqjddencnzp.supabase.co",
    supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRkemJkZHhpbmVxamRkZW5jbnpwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU5ODI3MzQsImV4cCI6MjA5MTU1ODczNH0.kAtoh63T4VvwjW-ZCZ5a45Uq1y9YF-RBwgUboJr-YWo",
    // Fallback settings if no user API key is provided
    defaultOpenAIModel: "gpt-4o-mini"
};
