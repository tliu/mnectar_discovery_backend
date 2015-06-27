mNectar.selectActive = true;
mNectar.rectActive = false;
mNectar.fakeClick = false;

var appendTerminal = function(data) {
    var text = "" + $("#terminal").html() + data + "<br>";
    console.log(text);
    $("#terminal").html(text);
}

$("#onoff").click(function() {
    mNectar.fakeClick = !mNectar.fakeClick;
    if (mNectar.fakeClick) {
        $("#onoff").html("<b>On</b> / Off")
    } else {
        $("#onoff").html("On / <b>Off</b>")
    }
});

$("#portrait").click(function() {
    $.ajax({
        url: "/portrait",
        success: (function(data) {
            $("#mnectar-canvas").width(320);
            $("#mnectar-canvas").height(480);
            startStream();
            appendTerminal(data);
        })
    });
});



$("#install").click(function() {
    $("#upload-apk").submit();
});

$("#upload-apk").submit(function() {
    console.log ("foo");
});

$("#landscape").click(function() {
    $.ajax({
        url: "/landscape",
        success: (function(data) {
            $("#mnectar-canvas").width(480);
            $("#mnectar-canvas").height(320);
            startStream();
            appendTerminal(data);
        })
    });
});

$("#homebutton").click(function() {
    $.ajax({
        url: "/homebutton",
        success: (function(data) {
        })
    });
});

var button = document.getElementById("gencmd");
button.onclick = function() {
    var table = document.getElementById("clickTable");
    var cmd = "timeout=10&" +
              "sw=" + data.virtualMachineProfile.screenWidth + "&" +
              "sh=" + data.virtualMachineProfile.screenHeight + "&" +
              "o=" + data.deviceOrientation.identifier + "&" +
              "cl=";
    for (var i = 1, row; row = table.rows[i]; i++) {
        for (var j = 0, col; col = row.cells[j]; j++) {
            if (j == 7) {
                cmd += document.getElementById("threshold-row-" + i).value;
            } else if (j >= 8) {
                continue;
            } else {
                cmd += col.innerHTML + ",";
            }
        }
        cmd += "_";
    }
    document.getElementById("cmdDisplay").innerHTML = cmd.slice(0, -1);
}


mNectar.VmClient.prototype._mouseEnd = function (e) {
    this._cancelEvent(e);

    var canvas = document.getElementById("mnectar-canvas");
    if (mNectar.rectActive && e.x != mNectar.startX && e.y != mNectar.startY && mNectar.fakeClick) {
        mNectar.rectActive = false;
        canvas.style.cursor = "pointer"
        return;
    }

    this._mouseInteractionStarted = false;

    this._queueMouseInteraction(2, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
    this._queueMouseInteraction(3, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
};


mNectar.VmClient.prototype._mouseMove = function (e) {
    this._cancelEvent(e);

    if (mNectar.rectActive) {
        var rect = document.getElementById("mnrect");
        rect.style.width = Math.abs(e.x - mNectar.startX) + "px";
        rect.style.height = Math.abs(e.y - mNectar.startY) + "px";
        rect.style.left = (e.x - mNectar.startX < 0) ? e.x + "px" : mNectar.startX + "px";
        rect.style.top = (e.y - mNectar.startY < 0) ? e.y + "px" : mNectar.startY + "px";
        return;
    } else {
        if (!this._mouseInteractionStarted) {
            return;
        }

        this._queueMouseInteraction(2, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
    }
};

mNectar.VmClient.prototype._mouseStart = function (e) {
    this._cancelEvent(e);

    if (mNectar.fakeClick) {

        if (window.pageXOffset != 0 || window.pageYOffset != 0) {
            window.scroll(0,0);
            return;
        }

        var canvas = document.getElementById("mnectar-canvas");
        if (mNectar.rectActive) {
            mNectar.rectActive = false;
            canvas.style.cursor = "pointer"
            return;
        }

        if (canvas.style.cursor == "pointer") {
            var rect = document.getElementById("mnrect");
            var x = rect.style.left.slice(0, -2);
            var y = rect.style.top.slice(0, -2);
            var w = rect.style.width.slice(0, -2);
            var h = rect.style.height.slice(0, -2);
            if (w < 9 || h < 9) {
                $("#mnrect").remove();
                canvas.style.cursor = "default";
                return;
            }
            var hashurl = "http://" + document.getElementById("storage").innerHTML + "/hash?x=" + x + "&y=" + y + "&w=" +  w + "&h=" + h;

            $.ajax({
                url: hashurl,
                success: (function(data) {
                    console.log (data);
                    canvas.style.cursor = "default";
                    var t = document.getElementById("clickTable");
                    var row = t.insertRow(-1);
                    row.setAttribute("id", "row-" + row.rowIndex);
                    data = JSON.parse(data);
                    var cell = row.insertCell(0);
                    cell.innerHTML = data.hash;
                    cell = row.insertCell(1);
                    cell.innerHTML = rect.style.left.slice(0, -2);
                    cell = row.insertCell(2);
                    cell.innerHTML = rect.style.top.slice(0, -2);
                    cell = row.insertCell(3);
                    cell.innerHTML = rect.style.width.slice(0, -2);
                    cell = row.insertCell(4);
                    cell.innerHTML = rect.style.height.slice(0, -2);
                    cell = row.insertCell(5);
                    cell.innerHTML = e.x;
                    cell = row.insertCell(6);
                    cell.innerHTML = e.y;
                    cell = row.insertCell(7);
                    cell.innerHTML = "<input value=15 min='0' max='64' type='number' style='width: 60px' id='threshold-row-" + row.rowIndex + "'></input>";
                    cell = row.insertCell(8);
                    cell.innerHTML = "<img src='" + data.image + "'/>"
                    cell = row.insertCell(9);
                    cell.innerHTML = "<button id='run-row-" +  row.rowIndex + "'>Click on " + e.x + ", " + e.y + "</button>";
                    cell = row.insertCell(10);
                    cell.innerHTML = "<button id='delete-row-" +  row.rowIndex + "'>Delete</button>";
                    document.getElementById("run-row-" + row.rowIndex).addEventListener("click", (function(){
                        this._queueMouseInteraction(1, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
                        this._queueMouseInteraction(2, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
                        this._queueMouseInteraction(3, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
                    }).bind(this));

                    $("#delete-row-" + row.rowIndex).click(function() {
                        $("#clickTable")[0].deleteRow(row.rowIndex);
                    });
                    }).bind(this)
                })
        } else {
            if (mNectar.selectActive) {
                mNectar.startX = e.x;
                mNectar.startY = e.y;
                $("#mnrect").remove();
                var el = document.createElement('div');
                el.setAttribute("id", "mnrect");
                el.style.border = "1px solid rgba(255, 0, 0, 0.8)";
                el.style.pointerEvents = "none";
                el.style.position = "absolute";
                el.style.left = e.x + "px";
                el.style.top = e.y + "px";
                canvas.appendChild(el);
                canvas.style.cursor = "crosshair";
                mNectar.rectActive = true;
                return;
            }
        }
    } else {
        this._mouseInteractionStarted = true;
        this._queueMouseInteraction(1, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
    }

};


