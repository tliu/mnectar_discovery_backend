// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Function/bind#Compatibility
if (!Function.prototype.bind) {
    Function.prototype.bind = function (oThis) {
        if (typeof this !== "function") {
            // closest thing possible to the ECMAScript 5
            // internal IsCallable function
            throw new TypeError("Function.prototype.bind - what is trying to be bound is not callable");
        }

        var aArgs = Array.prototype.slice.call(arguments, 1);
        var fToBind = this;
        var fNOP = function () {};
        var fBound = function () {
            return fToBind.apply(this instanceof fNOP && oThis ? this : oThis, aArgs.concat(Array.prototype.slice.call(arguments)));
        };

        fNOP.prototype = this.prototype;
        fBound.prototype = new fNOP();

        return fBound;
    };
}

// http://www.paulirish.com/2011/requestanimationframe-for-smart-animating/
(function() {
    var lastTime = 0;
    var vendors = ["ms", "moz", "webkit", "o"];
    for(var x = 0; x < vendors.length && !window.requestAnimationFrame; ++x) {
        window.requestAnimationFrame = window[vendors[x] + "RequestAnimationFrame"];
        window.cancelAnimationFrame = window[vendors[x] + "CancelAnimationFrame"] || window[vendors[x] + "CancelRequestAnimationFrame"];
    }

    if (!window.requestAnimationFrame) {
        window.requestAnimationFrame = function(callback, element) {
            var currTime = new Date().getTime();
            var timeToCall = Math.max(0, 16 - (currTime - lastTime));
            var id = window.setTimeout(function() { callback(currTime + timeToCall); }, timeToCall);
            lastTime = currTime + timeToCall;
            return id;
        };
    }

    if (!window.cancelAnimationFrame) {
        window.cancelAnimationFrame = function(id) {
            clearTimeout(id);
        };
    }
}());

var mNectar = mNectar || {};

mNectar.VmClient = function (session) {
    var parameters = session.vmSessionHttpArgs || "";
    this._httpReadURL = session.vmSessionHttpReadUrl + "/jpegstream?" + parameters;
    this._httpWriteURL = session.vmSessionHttpWriteUrl + "/input?hwp=" + session.vmSessionHttpWritePort;
    this._wsURL = session.vmSessionWsUrl;

    this._retryTimeout = 0.1; // 100ms
    this._connectTimeout = 5;
    this._keepaliveTimeout = 1;
    this._idleTimeout = 5;

    this._onTimeout = session.vmTimeout;
    this._onError = session.vmError;
    this._onOpen = session.vmOpen;
    this._onFailed = session.vmFailed;
    this._onClose = session.vmClose;

    this._streamWidth = session.streamWidth;
    this._streamHeight = session.streamHeight;
    this._orientation = session.orientation;

    this._fps = 1000 / 35;

    var container = this._container = document.getElementById(session.containerId);

    if (container) {
        container.innerHTML = "";

        var containerWidth = this._streamWidth;
        var containerHeight = this._streamHeight;
        try {
            var containerStyles = window.getComputedStyle(container);
            containerWidth = parseInt(containerStyles.width);
            containerHeight = parseInt(containerStyles.height);
        } catch (e) {
        }


        console.log(containerWidth);
        console.log(containerHeight);
        var displayInteractionScreen = document.createElement("canvas");
        displayInteractionScreen.className = "mn-vm-screen";
        container.appendChild(displayInteractionScreen);

        if (this._streamWidth / this._streamHeight > containerWidth / containerHeight) {

        } else {
            displayInteractionScreen.style.width = "auto";
            displayInteractionScreen.style.height = "100%";
        }

        this._displayScreen = displayInteractionScreen;
        this._initializeDisplayScreen();

        this._interactionScreen = displayInteractionScreen;
        this._initializeInteractionScreen();

        this._imageScreen = this._displayScreen; // XXX fix template!
    }
};

mNectar.VmClient.prototype.connect = function () {
    var connection = this._connection;

    if (connection && connection.readyState === WebSocketish.OPEN) {
        return;
    }

    this._killRetryTimer();
    this._killConnectTimer();
    this._killKeepaliveTimer();
    this._killIdleTimer();

    this._connectTimer = window.setTimeout((function (event) {
        this._killConnectTimer();
        this._killRetryTimer();

        var onFailed = this._onFailed;

        if (typeof onFailed === "function") {
            onFailed(this);
        }
    }).bind(this), this._connectTimeout * 1000);

    var connect = (function (event) {
        var empty = new Uint8Array(9);
        empty[0] = 0;
        empty[1] = 0;
        empty[2] = 0;
        empty[3] = 0;
        empty[4] = 0;

        if (this._connection.readyState === WebSocketish.OPEN) {
            this._connection.onopen = null;

            this._connection.onerror = this._connection.onclose = function (event) {
                this.disconnect();
            };

            this._killConnectTimer();
            this._killRetryTimer();
            this._killKeepaliveTimer();
            this._killIdleTimer();

            this._keepaliveTimer = window.setInterval((function (event) {
                if (!this._connection || [WebSocketish.CLOSING, WebSocketish.CLOSED].indexOf(this._connection.readyState) >= 0) {
                    this._killKeepaliveTimer();
                    this._killIdleTimer();
                    this._killConnection();

                    var onError = this._onError;

                    if (typeof onError === "function") {
                        onError(this);
                    }

                    return;
                }

                this._connection.send(empty);
            }).bind(this), this._keepaliveTimeout * 1000);

            this._connection.onmessage = (function(event) {
                this._killIdleTimer();

                this._idleTimer = window.setTimeout((function (event) {
                    this._killKeepaliveTimer();
                    this._killConnection();

                    var onTimeout = this._onTimeout;

                    if (typeof onTimeout === "function") {
                        onTimeout(this);
                    }
                }).bind(this), this._idleTimeout * 1000);

                var lastTimestamp = 0;
                if (event.data.byteLength >= 1) {
                    var firstBit = new Uint8Array(event.data.slice(0,1))[0];
                    if (firstBit == 0) {
                        this._onClose(this);
                    }
                    var data = event.data;
                    var maskSize = new Uint32Array(data.slice(1, 5))[0];
                    var maskBlob = new Blob([data.slice(5, maskSize)], {"type": "image/png"});
                    var imageBlob = new Blob([data.slice(5 + maskSize)], {"type": "image/jpeg"});

                    this._frames.push([maskBlob, imageBlob]);
                }
                else if (event.data.length >= 1) {
                    var data = String.prototype.slice.call(event.data, 0);
                    var maskSize = parseInt(data.slice(1, 11));
                    var firstBit = parseInt(data.slice(0, 1));
                    if (firstBit == 0) {
                        this._onClose(this);
                    }
                    mask = 'data:image/png;base64,' + data.slice(11, maskSize + 10);
                    image = 'data:image/jpeg;base64,' + data.slice(11 + maskSize);

                    this._frames.push([mask, image]);
                }
            }).bind(this);

            var onOpen = this._onOpen;

            if (typeof onOpen === "function") {
                onOpen(this);
            }
        } else if (this._connection.readyState === WebSocketish.CLOSED) {
            this._killRetryTimer();

            this._retryTimer = window.setTimeout(connect, this._retryTimeout * 1000);
        }
    }).bind(this);

    this._killConnection();

    if (WebSocketish === window.WebSocket) {
        this._connection = new WebSocket(this._wsURL);
    }
    else {
        this._connection = new WebSocketish(this._httpReadURL, this._httpWriteURL);
    }
    var connection = this._connection;
    connection.binaryType = 'arraybuffer';
    connection.onerror = connection.onclose = connection.onopen = connect;
};

mNectar.VmClient.prototype.disconnect = function () {
    this._killRetryTimer();
    this._killConnectTimer();
    this._killKeepaliveTimer();
    this._killIdleTimer();
    this._killConnection();
};

mNectar.VmClient.prototype._killRetryTimer = function () {
    if (this._retryTimer) {
        window.clearTimeout(this._retryTimer);

        this._retryTimer = null;
    }
};

mNectar.VmClient.prototype._killConnectTimer = function () {
    if (this._connectTimer) {
        window.clearTimeout(this._connectTimer);

        this._connectTimer = null;
    }
};

mNectar.VmClient.prototype._killKeepaliveTimer = function () {
    if (this._keepaliveTimer) {
        window.clearInterval(this._keepaliveTimer);

        this._keepaliveTimer = null;
    }
};

mNectar.VmClient.prototype._killIdleTimer = function () {
    if (this._idleTimer) {
        window.clearTimeout(this._idleTimer);

        this._idleTimer = null;
    }
};

mNectar.VmClient.prototype._killConnection = function () {
    if (this._connection) {
        this._connection.onerror = this._connection.onclose = this._connection.onopen = this._connection.onmessage = null;

        this._connection.close();

        this._connection = null;
    }
};

mNectar.VmClient.prototype._initializeDisplayScreen = function () {
    if (this._initializedDisplayScreen) {
        return;
    } else {
        this._initializedDisplayScreen = true;
    }

    var displayScreen = this._displayScreen;

    var displayCanvas = this._displayCanvas = displayScreen;
    this._displayContext = displayCanvas.getContext("2d");

    var frameCanvas = this._frameCanvas = document.createElement("canvas");
    this._frameContext = frameCanvas.getContext("2d");

    displayCanvas.width = this._streamWidth;
    displayCanvas.height = this._streamHeight;

    this._mask = new Image();
    this._image = new Image();
    this._frames = [];

    window.requestAnimationFrame(this._processFrame.bind(this));
}

mNectar.VmClient.prototype._queueFrame = function (mask, image, lastTimestamp) {
    this._frames.push([mask, image, lastTimestamp]);
};

mNectar.VmClient.prototype._processFrame = function () {
    var frames = this._frames;
    var fps = this._fps;

    if (frames && frames.length) {
        var frame = frames.shift();
        var maskBlob = frame[0];
        var imageBlob = frame[1];

        var maskData = maskBlob;
        if (typeof maskBlob !== "string") {
            maskData = URL.createObjectURL(maskBlob);
        }
        var imageData = imageBlob;
        if (typeof imageBlob !== "string") {
            imageData = URL.createObjectURL(imageBlob);
        }

        var mask = this._mask;
        mask.src = maskData;
        mask.onload = (function() {
            var image = this._image;
            image.src = imageData;
            image.onload = (function() {
                URL.revokeObjectURL(maskData);
                URL.revokeObjectURL(imageData);

                this._drawFrame(mask, image);

                window.requestAnimationFrame(this._processFrame.bind(this));
            }).bind(this);
        }).bind(this);
    } else {
        window.requestAnimationFrame(this._processFrame.bind(this));
    }
};

mNectar.VmClient.prototype._drawFrame = function (mask, image) {
    var displayCanvas = this._displayCanvas;
    var displayContext = this._displayContext;
    var frameCanvas = this._frameCanvas;
    var frameContext = this._frameContext;

    if (!(displayCanvas && displayContext && frameCanvas && frameContext)) {
        return;
    }

    var maskWidth = mask.width;
    var maskHeight = mask.height;
    var imageWidth = image.width;
    var imageHeight = image.height;

    frameCanvas.width = imageWidth;
    frameCanvas.height = imageHeight;

    frameContext.webkitImageSmoothingEnabled = false;
    frameContext.imageSmoothingEnabled = false;
/*
    if (this._orientation == "l") {
        //displayCanvas.width = imageHeight;
        //displayCanvas.height = imageWidth;
        frameCanvas.width = imageHeight;
        frameCanvas.height = imageWidth;
        cw = frameCanvas.width;
        ch = frameCanvas.height;
        //#frameContext.save();
        frameContext.translate(cw, ch / cw);
        frameContext.rotate(Math.PI / 2);
        //displayContext.translate(cw, ch / cw);
        //displayContext.rotate(Math.PI / 2);
    }

   */


    frameContext.clearRect(0, 0, imageWidth, imageHeight);

    frameContext.globalCompositeOperation = "source-over";
    frameContext.drawImage(mask, 0, 0, maskWidth, maskHeight, 0, 0, maskWidth * 8, maskHeight * 8);

    frameContext.globalCompositeOperation = "source-in";
    frameContext.drawImage(image, 0, 0, imageWidth, imageHeight, 0, 0, imageWidth, imageHeight);

    frameContext.webkitImageSmoothingEnabled = true;
    frameContext.imageSmoothingEnabled = true;

    displayContext.drawImage(frameCanvas, 0, 0, frameCanvas.width, frameCanvas.height, 0, 0, frameCanvas.width, frameCanvas.height);

    if (this._orientation == "l") {
        //frameContext.restore();
    }



};

mNectar.VmClient.prototype._initializeInteractionScreen = function () {
    if (this._initializedInteractionScreen) {
        return;
    } else {
        this._initalizedInteractionScreen = true;
    }

    this._interactions = [];
    this._mouseInteractionStarted = false;

    var interactionScreen = this._interactionScreen;
    var usesTouchEvents = this._usesTouchEvents = interactionScreen.ontouchstart !== undefined ? true : false;

    if (usesTouchEvents) {
        interactionScreen.addEventListener("touchmove", this._touchMove.bind(this), true);
        interactionScreen.addEventListener("touchstart", this._touchStart.bind(this), true);
        interactionScreen.addEventListener("touchend", this._touchEnd.bind(this), true);

        window.setInterval(this._processTouchInteractions.bind(this), 1)
    } else {
        interactionScreen.addEventListener("mousemove", this._mouseMove.bind(this), true);
        interactionScreen.addEventListener("mousedown", this._mouseStart.bind(this), true);
        interactionScreen.addEventListener("mouseup", this._mouseEnd.bind(this), true);
        interactionScreen.addEventListener("mouseout", this._mouseOut.bind(this), true);

        window.setInterval(this._processMouseInteractions.bind(this), 1)
    }
};

mNectar.VmClient.prototype._processTouchInteractions = function () {
    var interactions = this._interactions;

    if (interactions && interactions.length) {
        var interaction = this._interactions.shift();

        this._sendTouchInteraction(interaction[0], interaction[1], interaction[2], interaction[3]);
    }
};

mNectar.VmClient.prototype._processMouseInteractions = function () {
    var interactions = this._interactions;

    if (interactions && interactions.length) {
        var interaction = this._interactions.shift();

        this._sendMouseInteraction(interaction[0], interaction[2], interaction[3]);
    }
};

mNectar.VmClient.prototype._sendTouchInteraction = function (type, slot, clientX, clientY) { // XXX clean up
    var connection = this._connection;
    var interactionScreen = this._interactionScreen;

    if (!(connection && connection.readyState === WebSocketish.OPEN && interactionScreen)) {
        return;
    }

    var w = interactionScreen.width;
    var h = interactionScreen.height;
    var x = clientX;
    var y = clientY;
    var x = clientX - interactionScreen.offsetLeft;
    var y = clientY - interactionScreen.offsetTop;

//    var parent = interactionScreen.offsetParent;
//    while (parent && parent !== document.body) {
//        x -= parent.offsetLeft - parent.scrollLeft;
//        y -= parent.offsetTop  - parent.scrollTop;
//
//        parent = parent.offsetParent;
//    }
//
//    if (parent) {
//        var documentScrollLeft = document.body.scrollLeft || document.documentElement.scrollLeft;
//        var documentScrollTop = document.body.scrollTop || document.documentElement.scrollTop;
//
//        x -= parent.offsetLeft - documentScrollLeft;
//        y -= parent.offsetTop  - documentScrollTop;
//    }

    x = Math.round(x * w / interactionScreen.offsetWidth);
    y = Math.round(y * h / interactionScreen.offsetHeight);

    var message = new Uint8Array(9);
    message[0] = type;
    message[1] = slot;
    message[2] = (x >> (8 * 1)) & 0xff;
    message[3] = (x >> (8 * 0)) & 0xff;
    message[4] = (y >> (8 * 1)) & 0xff;
    message[5] = (y >> (8 * 0)) & 0xff;

    this._connection.send(message);
};

mNectar.VmClient.prototype._sendMouseInteraction = function (type, offsetX, offsetY) { // XXX clean up
    var connection = this._connection;
    var interactionScreen = this._interactionScreen;

    if (!(connection && connection.readyState === WebSocketish.OPEN && interactionScreen)) {
        return;
    }

    var w = interactionScreen.width;
    var h = interactionScreen.height;
    var x = offsetX;
    var y = offsetY;

    x = Math.round(x * w / interactionScreen.offsetWidth);
    y = Math.round(y * h / interactionScreen.offsetHeight);

    var message = new Uint8Array(9);
    message[0] = type;
    message[1] = 0;
    message[2] = (x >> (8 * 1)) & 0xff;
    message[3] = (x >> (8 * 0)) & 0xff;
    message[4] = (y >> (8 * 1)) & 0xff;
    message[5] = (y >> (8 * 0)) & 0xff;

    this._connection.send(message);
};

mNectar.VmClient.prototype._queueTouchInteraction = function (type, slot, x, y) {
    this._interactions.push([type, slot, x, y]);
};

mNectar.VmClient.prototype._queueMouseInteraction = function (type, x, y) {
    this._interactions.push([type, 0, x, y]);
};

mNectar.VmClient.prototype._touchStart = function (e) {
    this._cancelEvent(e);

    if (e.touches.length < 1) {
        return;
    }


    for (var ix = 0; ix < e.changedTouches.length; ix++) {
        var touch = e.changedTouches[ix];
        var x= touch.clientX;
        var y= touch.clientY;
        if (this._orientation == "l") {
            y = 320 - touch.clientX;
            x = touch.clientY;
        }
        console.log(touch.clientX);
        console.log(touch.clientY);
        this._queueTouchInteraction(1, touch.identifier, x, y);
    }
};

mNectar.VmClient.prototype._touchMove = function (e) {
    this._cancelEvent(e);

    if (e.touches.length < 1) {
        return;
    }

    for (var ix = 0; ix < e.changedTouches.length; ix++) {
        var touch = e.changedTouches[ix];
        var x= touch.clientX;
        var y= touch.clientY;
        if (this._orientation == "l") {
            y = 320 - touch.clientX;
            x = touch.clientY;
        }
        console.log(touch.clientX);
        console.log(touch.clientY);
        this._queueTouchInteraction(2, touch.identifier, x, y);
    }
};

mNectar.VmClient.prototype._touchEnd = function (e) {
    this._cancelEvent(e);

    if (e.changedTouches.length < 1) {
        return;
    }

    for (var ix = 0; ix < e.changedTouches.length; ix++) {
        var touch = e.changedTouches[ix];
        var x= touch.clientX;
        var y= touch.clientY;
        if (this._orientation == "l") {
            y = 320 - touch.clientX;
            x = touch.clientY;
        }
        console.log(touch.clientX);
        console.log(touch.clientY);
        this._queueTouchInteraction(3, touch.identifier, x, y);
    }
};

mNectar.VmClient.prototype._mouseMove = function (e) {
    this._cancelEvent(e);

    if (!this._mouseInteractionStarted) {
        return;
    }

    this._queueMouseInteraction(2, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
};

mNectar.VmClient.prototype._mouseStart = function (e) {
    this._cancelEvent(e);

    this._mouseInteractionStarted = true;

    this._queueMouseInteraction(1, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
};

mNectar.VmClient.prototype._mouseEnd = function (e) {
    this._cancelEvent(e);

    this._mouseInteractionStarted = false;

    this._queueMouseInteraction(2, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
    this._queueMouseInteraction(3, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
};

mNectar.VmClient.prototype._mouseOut = function (e) {
    this._cancelEvent(e);

    this._mouseInteractionStarted = false;

    this._queueMouseInteraction(3, e.offsetX !== undefined ? e.offsetX : e.layerX, e.offsetY !== undefined ? e.offsetY : e.layerY);
};

mNectar.VmClient.prototype._cancelEvent = function (e) {
    e.stopPropagation();

    if (e.preventDefault) {
        e.preventDefault();
    } else {
        e.returnValue = false;
    }
};

mNectar.WebSocketish = function (httpReadURL, httpWriteURL) {
    this.__outputBuffer = "";

    this.readyState = mNectar.WebSocketish.CLOSED;

    this._httpReadURL = httpReadURL;
    this._httpWriteURL = httpWriteURL;

    this.__iframe = document.createElement("iframe");
    this.__iframe.src = "about:blank";
    this.__iframe.style.display = "none";

    document.body.appendChild(this.__iframe);

    this.readyState = WebSocketish.CONNECTING;

    this.__iframe.src = httpReadURL;

    window.addEventListener("message", this.__messageHandler.bind(this));

    this.__killConnectionTimer();
    this.__connectionTimer = window.setTimeout(this.__closeUnexpected.bind(this), 1000 * 60 * 5);
};

mNectar.WebSocketish.prototype.__killConnectionTimer = function () {
    if (this.__connectionTimer) {
        window.clearTimeout(this.__connectionTimer);

        this.__connectionTimer = null;
    }
}

mNectar.WebSocketish.prototype.__killStallTimer = function () {
    if (this.__stallTimer) {
        window.clearTimeout(this.__stallTimer);

        this.__stallTimer = null;
    }
}

mNectar.WebSocketish.prototype.__killMessageHandler = function () {
    window.removeEventListener("message", this.__messageHandler);
}

mNectar.WebSocketish.prototype.__messageHandler = function (event) {
    this.__killStallTimer();

    if (this.readyState === mNectar.WebSocketish.CONNECTING) {
        this.__killConnectionTimer();

        this.readyState = mNectar.WebSocketish.OPEN;

        if (typeof this.onopen === 'function') {
            this.onopen(event);
        }

        this.__processOutputBuffer();
    }

    if (typeof this.onmessage === 'function') {
        this.onmessage(event);
    }

//    this.__stallTimer = window.setTimeout(this.__closeUnexpected.bind(this), 1000 * 60 * 5);
}

mNectar.WebSocketish.prototype.__closeUnexpected = function () {
    if (typeof this.onerror === 'function') {
        this.onerror(event);
    }

    this.close();
}

mNectar.WebSocketish.prototype.close = function () {
    this.__killConnectionTimer();
    this.__killMessageHandler();
    this.__killStallTimer();

    this.readyState = WebSocketish.CLOSING;

    if (this.__iframe) {
        this.__iframe.src = "about:blank";

        document.body.removeChild(this.__iframe);

        this.__iframe = null;
    }

    this.readyState = WebSocketish.CLOSED;

    if (typeof this.onclose === 'function') {
        this.onclose(event);
    }
}

mNectar.WebSocketish.prototype.__processOutputBuffer = function (event) {
    if (this.readyState !== mNectar.WebSocketish.OPEN) {
        return;
    }

    if (this.__outputBuffer.length) {
        var buffer = this.__outputBuffer;

        var xhr = new XMLHttpRequest();
        xhr.open("POST", this._httpWriteURL);
        //xhr.setRequestHeader("Content-type", "text/plain; charset=UTF-8");

        xhr.onreadystatechange = (function (event) {
            if (xhr.readyState === 4 && xhr.status !== 200) {
                this.__closeUnexpected();
            }
        }).bind(this);

        xhr.send(this.__outputBuffer.buffer);

        this.__outputBuffer = "";
    }

    this.__processOutputBufferTimer = window.setTimeout(this.__processOutputBuffer.bind(this), 10);
}

mNectar.WebSocketish.prototype.send = function (data) {
    if (this.readyState !== mNectar.WebSocketish.OPEN) {
        return;
    }

    this.__outputBuffer = data;
}

mNectar.WebSocketish.CONNECTING = 0;
mNectar.WebSocketish.OPEN = 1;
mNectar.WebSocketish.CLOSING = 2;
mNectar.WebSocketish.CLOSED = 3;

WebSocketish = mNectar.WebSocketish;

try {
    var wstest = new WebSocket("wss://plzfail/");
    // the Android browser does not support websockets, but it has
    // a native implementation of the WebSocket object that does
    // nothing. Fortunately, these three properties only exist in
    // browsers that actually support websockets
    if (wstest.binaryType !== undefined && wstest.protocol !== undefined && wstest.extensions !== undefined) {
        WebSocketish = window.WebSocket;
    }
} catch (e) {
}

