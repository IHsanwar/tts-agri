import sqlite3

conn = sqlite3.connect(r"C:\Users\ihsan\VScodeProject\Tugas Kuliah (IPB Moments)\English Game 1\backend\data\tts.sqlite")
cur = conn.cursor()
cur.execute("SELECT name FROM sqlite_master WHERE type='table'")
tables = [r[0] for r in cur.fetchall()]
print("TABLES:", tables)
try:
    cur.execute("SELECT version_num FROM alembic_version")
    print("ALEMBIC_VERSION:", cur.fetchall())
except Exception as e:
    print("No alembic_version:", e)
conn.close()
