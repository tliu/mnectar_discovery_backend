import sqlite3
from flask import g
from flask import Flask
from os import listdir
import json
from scrape import scrape

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


@app.route("/game/categories")
def get_categories():
    cur = get_db().cursor()
    query = cur.execute("select category from game group by category")
    categories =  cur.fetchall()
    category_dict = {}
    for cat in categories:
        query = query_db("select * from game where category='%s'" % cat[0])
        category_dict[cat[0]] = query;

    cur.connection.close()
    return json.dumps(category_dict)

@app.route("/game/category/<category>")
def get_games_in_category(category):
    query = query_db("select id from game where category='%s'" % category)
    return json.dumps(query)

@app.route("/game/<id>")
def get_game_by_id(id):
    query = query_db("select * from game where id=%s" % id)
    return json.dumps(query)



image_path_prefix = "/assets/"

@app.route("/game/<id>/images")
def get_game_images(id):
    return json.dumps(map(lambda x:image_path_prefix + "%s/%s" % (id, x), listdir(".%s/%s" % (image_path_prefix, id))))


@app.route("/game/add/<package>")
def add_package(package):
    cur = get_db().cursor()
    cur.execute("insert into game (package) values (?)", (package,))
    get_db().commit()
    id = cur.lastrowid
    res = scrape(id, package)
    name = res[0]
    desc = res[1]
    rating = float(res[2])
    activity = res[4]
    category = res[5]
    cur.execute("update game set name='%s',description='%s',rating=%f,activity='%s',category='%s' where id=%d" % (name, desc, rating, activity, category, int(id)))
    get_db().commit()
    cur.connection.close()
    return json.dumps(id)

def query_db(query, args=(), one=False):
    cur = get_db().cursor()
    cur.execute(query, args)
    r = [dict((cur.description[i][0], value) \
               for i, value in enumerate(row)) for row in cur.fetchall()]
    return (r[0] if r else None) if one else r

if __name__ == "__main__":
    app.run(debug=True, host='0.0.0.0', port=8080)
