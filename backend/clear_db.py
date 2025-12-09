"""
Clear all data from the alerts table in the database
"""
import sqlite3
import os

# Path to database
db_path = os.path.join(os.path.dirname(__file__), "railguard.db")

if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    # Delete all records from alerts table
    cursor.execute("DELETE FROM alerts")
    conn.commit()
    
    # Get count to verify
    cursor.execute("SELECT COUNT(*) FROM alerts")
    count = cursor.fetchone()[0]
    
    conn.close()
    
    print(f"✅ Database cleared successfully!")
    print(f"   Remaining alerts: {count}")
else:
    print("❌ Database file not found!")
