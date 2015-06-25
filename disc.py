import sqlite3
from flask import g
from flask import Flask
from os import listdir
import json

app = Flask(__name__)
DATABASE = 'disc.db'

def connect_to_database():
    return sqlite3.connect(DATABASE)

def get_db():
    db = getattr(g, '_database', None)
    if db is None:
        db = g._database = connect_to_database()
    return db

@app.teardown_appcontext
def close_connection(exception):
    db = getattr(g, '_database', None)
    if db is not None:
        db.close()


@app.route("/game/<id>")
def get_game_by_id(id):
    query = query_db("select * from game where id=%s" % id)
    print query
    return json.dumps(query)


image_path_prefix = "/assets/"

@app.route("/game/<id>/images")
def get_game_images(id):
    return json.dumps(map(lambda x:image_path_prefix + "%s/%s" % (id, x), listdir(".%s/%s" % (image_path_prefix, id))))


def query_db(query, args=(), one=False):
    cur = get_db().cursor()
    cur.execute(query, args)
    r = [dict((cur.description[i][0], value) \
               for i, value in enumerate(row)) for row in cur.fetchall()]
    cur.connection.close()
    return (r[0] if r else None) if one else r

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=8080)