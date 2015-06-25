import os

f = os.popen("python list.py GAME apps_topgrossing 100").read()


for line in f.strip().split("\n"):
    pkgname = line.split(";")[1]
    print "Downloading %s..." % pkgname
    f = os.popen("python download.py %s apks/%s.apk" % (pkgname, pkgname)).read()
    print f
