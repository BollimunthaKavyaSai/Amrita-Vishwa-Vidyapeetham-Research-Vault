import csv
import mysql.connector

def get_or_create(cursor, select_query, insert_query, value):
    cursor.execute(select_query, (value,))
    row = cursor.fetchone()
    if row:
        return row[0]
    else:
        cursor.execute(insert_query, (value,))
        return cursor.lastrowid

# Connect to MySQL db
conn = mysql.connector.connect(
    host='localhost',
    user='root',
    password='Kavya@1356',  # Update this
    database='dbms'
)
cursor = conn.cursor()

with open('classified_papers.csv', encoding='utf-8') as csvfile:
    reader = csv.DictReader(csvfile)
    for row in reader:
        # Domains
        domain_name = row.get('Main Domain', 'Others').strip()
        domain_id = get_or_create(cursor,
            "SELECT domain_id FROM domains WHERE domain_name=%s",
            "INSERT INTO domains(domain_name) VALUES (%s)",
            domain_name)

        # Insert paper
        cursor.execute(
            "INSERT INTO papers (title, domain_id, year, doi) VALUES (%s, %s, %s, %s)",
            (row.get('Title'), domain_id, row.get('Year'), row.get('DOI'))
        )
        paper_id = cursor.lastrowid

        # Authors (split by comma)
        authors = row.get('Authors', '').split(',')
        for author in map(str.strip, authors):
            if author:
                author_id = get_or_create(cursor,
                    "SELECT author_id FROM authors WHERE author_name=%s",
                    "INSERT INTO authors(author_name) VALUES (%s)",
                    author)
                cursor.execute(
                    "INSERT INTO paper_authors (paper_id, author_id) VALUES (%s, %s)",
                    (paper_id, author_id)
                )

        # Keywords (split by comma)
        keywords = row.get('keywords_cleaned', '').split(',')
        for kw in map(str.strip, keywords):
            if kw:
                keyword_id = get_or_create(cursor,
                    "SELECT keyword_id FROM keywords WHERE keyword=%s",
                    "INSERT INTO keywords(keyword) VALUES (%s)",
                    kw)
                cursor.execute(
                    "INSERT INTO paper_keywords (paper_id, keyword_id) VALUES (%s, %s)",
                    (paper_id, keyword_id)
                )

conn.commit()
cursor.close()
conn.close()
