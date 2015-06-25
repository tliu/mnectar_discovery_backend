import os
import urllib2
import urllib

import sys
import axmlparserpy.apk as apk

sys.path.append('./googleplay-api')
from pprint import pprint

from config import *
from googleplay import GooglePlayAPI
from helpers import sizeof_fmt

def scrape(id, package):

    packagename = package
    res = urllib2.urlopen('https://play.google.com/store/apps/details?id=%s&hl=en' % packagename)
    html = res.read()

    path = "assets/%d/" % id
    if not os.path.exists(path):
        os.makedirs(path)

    name = html.split('itemprop="name"')[1].split("</div>")[0].split("<div>")[1]
    desc = html.split('<div class="show-more-content text-body" itemprop="description">')[1].split('<div class="show-more-end">')[0]
    rating = html.split("Rated ")[1].split(" stars")[0]

    stuff = []
    for line in html.split("</div>"):
        if "full-screenshot" in line:
            url =  line.split('src="')[1][:-3]
            stuff.append(url)



    x = 0
    for img in stuff[1:]:
        print img
        urllib.urlretrieve(img, "%s%d.webp" % (path, x))
        x+=1




    filename = path + packagename + ".apk"

    # Connect
    api = GooglePlayAPI(ANDROID_ID)
    api.login(GOOGLE_LOGIN, GOOGLE_PASSWORD, AUTH_TOKEN)

    # Get the version code and the offer type from the app details
    m = api.details(packagename)
    doc = m.docV2
    vc = doc.details.appDetails.versionCode
    ot = doc.offer[0].offerType

    # Download
    print "Downloading %s..." % sizeof_fmt(doc.details.appDetails.installationSize),
    data = api.download(packagename, vc, ot)
    open(filename, "wb").write(data)
    print "Done"
    ap = apk.APK(filename)
    badging = os.popen("/home/thomas/dev/android-odroid/out/host/linux-x86/bin/aapt dump badging %s" % filename).read()
    for line in badging.split('\n'):
        if "launchable-activity" in line:
            activity = line.split("'")[1]

    return [name, desc, rating, package, activity]



