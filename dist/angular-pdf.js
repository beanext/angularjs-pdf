/*! Angular-PDF Version: 1.2.4 | Released under an MIT license */
(function () {

    'use strict';

    angular.module('pdf', []).directive('ngPdf', ['$window', function ($window) {
        var renderTask = null;
        var pdfLoaderTask = null;

        var backingScale = function (canvas) {
            var ctx = canvas.getContext('2d');
            var dpr = window.devicePixelRatio || 1;
            var bsr = ctx.webkitBackingStorePixelRatio ||
                ctx.mozBackingStorePixelRatio ||
                ctx.msBackingStorePixelRatio ||
                ctx.oBackingStorePixelRatio ||
                ctx.backingStorePixelRatio || 1;

            return dpr / bsr;
        };

        var setCanvasDimensions = function (canvas, w, h) {
            var ratio = backingScale(canvas);
            canvas.width = Math.floor(w * ratio);
            canvas.height = Math.floor(h * ratio);
            canvas.style.width = Math.floor(w) + 'px';
            canvas.style.height = Math.floor(h) + 'px';
            canvas.getContext('2d').setTransform(ratio, 0, 0, ratio, 0, 0);
            return canvas;
        };
        return {
            restrict: 'E',
            templateUrl: function (element, attr) {
                return attr.templateUrl ? attr.templateUrl : 'partials/viewer.html';
            },
            link: function (scope, element, attrs) {
                var url = scope.pdfUrl;
                var pdfDoc = null;
                var pageNum = (attrs.page ? attrs.page : 1);
                var scale;
                if (attrs.scale !== 'fill') {
                    scale = attrs.scale > 0 ? attrs.scale : 1;
                }
                var canvas;
                if (attrs) {
                    canvas = document.getElementById(attrs.canvasid);
                } else {
                    canvas = document.getElementById('pdf-canvas');
                }
                var canvasContainer = angular.element(canvas).parent();
                var creds = attrs.usecredentials;
                var ctx = canvas.getContext('2d');
                var windowEl = angular.element($window);

                windowEl.on('scroll', function () {
                    scope.$apply(function () {
                        scope.scroll = windowEl[0].scrollY;
                    });
                });

                PDFJS.disableWorker = true;
                scope.pageNum = pageNum;

                var isFullScreen = function () {
                    return document.fullscreen ||
                        document.webkitIsFullScreen ||
                        document.mozFullScreen ||
                        false;
                }
                var getFullScreenSupportName = function () {
                    var doc = document.documentElement;
                    if ('webkitRequestFullScreen' in doc) {
                        return 'webkitfullscreenchange';
                    } else if ('mozRequestFullScreen' in doc && document.mozFullScreenEnabled) {
                        return 'mozfullscreenchange';
                    } else if ('requestFullscreen' in doc) {
                        return 'fullscreenchange';
                    } else {
                        return false;
                    }
                }
                var isFullScreenSupport = function () {
                    var doc = document.documentElement;
                    return ( 'requestFullscreen' in doc ) ||
                        ( 'webkitRequestFullScreen' in doc ) ||
                        ( 'mozRequestFullScreen' in doc && document.mozFullScreenEnabled ) ||
                        false;
                }
                if (isFullScreenSupport()) {
                    document.addEventListener(
                        getFullScreenSupportName(),
                        function (evt) {
                            if (!isFullScreen()) {
                                canvasContainer.css({
                                    'text-align': 'center',
                                    position: 'relative',
                                    width: '100%',
                                    height: scope.originBox.height + 'px',
                                    margin: '',
                                    top: '',
                                    left: '',
                                    'overflow-y': ''
                                });
                            }
                            scale = undefined;
                            scope.changePage();
                        },
                        false
                    );
                }

                scope.mouseScrollReset = function () {
                    scope.mouseScrollTimeStamp = 0;
                    scope.mouseScrollDelta = 0;
                }

                var getWindowHeight = function () {
                    var windowHeight = 0;
                    if (document.compatMode == "CSS1Compat") {
                        windowHeight = document.documentElement.clientHeight;
                    } else {
                        windowHeight = document.body.clientHeight;
                    }
                    return windowHeight;
                }

                scope.mouseScrollReset();
                var handleMouseWheel = function (evt) {
                    if (isFullScreen() && canvas) {
                        var MOUSE_WHEEL_DELTA_FACTOR = 40;
                        var ticks = (evt.type === 'DOMMouseScroll') ? -evt.detail : evt.wheelDelta / MOUSE_WHEEL_DELTA_FACTOR;
                        var delta = ticks * MOUSE_WHEEL_DELTA_FACTOR;
                        var MOUSE_SCROLL_COOLDOWN_TIME = 50;
                        var PAGE_SWITCH_THRESHOLD = 120;
                        var PageSwitchDirection = {
                            UP: -1,
                            DOWN: 1
                        };
                        var currentTime = (new Date()).getTime();
                        var storedTime = scope.mouseScrollTimeStamp;
                        if (currentTime > storedTime &&
                            currentTime - storedTime < MOUSE_SCROLL_COOLDOWN_TIME) {
                            return;
                        }
                        if ((scope.mouseScrollDelta > 0 && delta < 0) ||
                            (scope.mouseScrollDelta < 0 && delta > 0)) {
                            scope.mouseScrollReset();
                        }
                        scope.mouseScrollDelta += delta;
                        if (Math.abs(scope.mouseScrollDelta) >= PAGE_SWITCH_THRESHOLD) {
                            var pageSwitchDirection = ( scope.mouseScrollDelta > 0) ?
                                PageSwitchDirection.UP : PageSwitchDirection.DOWN;
                            if ((pageSwitchDirection === PageSwitchDirection.DOWN && canvasContainer[0].scrollTop + getWindowHeight() == canvasContainer[0].scrollHeight) ||
                                (pageSwitchDirection === PageSwitchDirection.UP && canvasContainer[0].scrollTop == 0)) {
                                var page = scope.pageToDisplay;
                                scope.mouseScrollReset();
                                if ((page === 1 && pageSwitchDirection === PageSwitchDirection.UP) ||
                                    (page === scope.pageCount &&
                                    pageSwitchDirection === PageSwitchDirection.DOWN)) {
                                    return;
                                }
                                scope.pageToDisplay = parseInt(scope.pageToDisplay) + pageSwitchDirection;
                                scope.pageNum = scope.pageToDisplay;
                                scope.mouseScrollTimeStamp = currentTime;
                                scope.$apply();
                            }
                        }
                    }
                }
                window.addEventListener('DOMMouseScroll', handleMouseWheel);
                window.addEventListener('mousewheel', handleMouseWheel);
                window.addEventListener('mousedown', function (evt) {
                    if (isFullScreen() && canvas && evt.button === 0) {
                        var isInternalLink = (evt.target.href && evt.target.classList.contains('internalLink'));
                        if (!isInternalLink) {
                            evt.preventDefault();
                            scope.pageToDisplay = parseInt(scope.pageToDisplay) + (evt.shiftKey ? -1 : 1);
                            scope.pageNum = scope.pageToDisplay;
                            scope.$apply();
                        }
                    }
                });

                scope.fullScreen = function () {
                    if (isFullScreenSupport()) {
                        if (isFullScreen()) {
                            exitFullscreen();
                        } else {
                            var resequestFullScreen = canvasContainer[0].requestFullScreen || canvasContainer[0].webkitRequestFullScreen || canvasContainer[0].mozRequestFullScreen;
                            if (resequestFullScreen) {
                                canvasContainer.css({
                                    position: 'fixed',
                                    top: '0',
                                    left: '0',
                                    margin: '0px 10%',
                                    width: '80%',
                                    height: '100%',
                                    'overflow-y': 'auto'
                                });
                                resequestFullScreen.call(canvasContainer[0]);
                            }
                        }
                    } else {
                        console.error('your browser is not support fullscreen api');
                    }
                }
                scope.renderPage = function (num) {
                    if (renderTask) {
                        renderTask._internalRenderTask.cancel();
                    }

                    pdfDoc.getPage(num).then(function (page) {
                        var viewport;
                        var pageWidthScale;
                        var pageHeightScale;
                        var renderContext;

                        if (attrs.scale === 'page-fit' && !scale) {
                            viewport = page.getViewport(1);
                            pageWidthScale = element[0].clientWidth / viewport.width;
                            pageHeightScale = element[0].clientHeight / viewport.height;
                            scale = Math.min(pageWidthScale, pageHeightScale);
                        } else if (attrs.scale === 'fill' && !scale) {
                            viewport = page.getViewport(1);
                            pageWidthScale = canvasContainer[0].clientWidth / viewport.width;
                            pageHeightScale = canvasContainer[0].clientHeight / viewport.height;
                            scale = Math.max(pageWidthScale, pageHeightScale);
                            viewport = page.getViewport(scale);
                        } else if (attrs.scale === 'rotate' && !scale) {
                            viewport = page.getViewport(1);
                            pageWidthScale = canvasContainer[0].clientHeight / viewport.width;
                            pageHeightScale = canvasContainer[0].clientWidth / viewport.height;
                            if (isFullScreen()) {
                                scale = Math.max(pageWidthScale, pageHeightScale);
                            } else {
                                scale = Math.min(pageWidthScale, pageHeightScale);
                            }
                            viewport = page.getViewport(scale);
                        } else {
                            viewport = page.getViewport(scale);
                        }

                        setCanvasDimensions(canvas, viewport.width, viewport.height);

                        renderContext = {
                            canvasContext: ctx,
                            viewport: viewport
                        };

                        renderTask = page.render(renderContext);
                        renderTask.promise.then(function () {
                            if (typeof scope.onPageRender === 'function') {
                                scope.onPageRender();
                            }
                        }).catch(function (reason) {
                            console.log(reason);
                        });
                    });
                };

                scope.onPageRender = function () {
                    if (!scope.originBox) {
                        scope.originBox = {
                            width: canvasContainer[0].clientWidth,
                            height: canvasContainer[0].clientHeight
                        }
                    }
                }
                scope.goPrevious = function () {
                    if (scope.pageToDisplay <= 1) {
                        return;
                    }
                    scope.pageToDisplay = parseInt(scope.pageToDisplay) - 1;
                    scope.pageNum = scope.pageToDisplay;
                };

                scope.goNext = function () {
                    if (scope.pageToDisplay >= pdfDoc.numPages) {
                        return;
                    }
                    scope.pageToDisplay = parseInt(scope.pageToDisplay) + 1;
                    scope.pageNum = scope.pageToDisplay;
                };

                scope.zoomIn = function () {
                    scale = parseFloat(scale) + 0.2;
                    scope.renderPage(scope.pageToDisplay);
                    return scale;
                };

                scope.zoomOut = function () {
                    scale = parseFloat(scale) - 0.2;
                    scope.renderPage(scope.pageToDisplay);
                    return scale;
                };

                scope.changePage = function () {
                    scope.renderPage(scope.pageToDisplay);
                };

                scope.rotateLT = function () {
                    if (canvas.getAttribute('class') === 'rotate0') {
                        canvas.setAttribute('class', 'rotate270');
                        attrs.scale = 'rotate';
                    } else if (canvas.getAttribute('class') === 'rotate90') {
                        canvas.setAttribute('class', 'rotate0');
                        attrs.scale = 'fill';
                    } else if (canvas.getAttribute('class') === 'rotate180') {
                        canvas.setAttribute('class', 'rotate90');
                        attrs.scale = 'rotate';
                    } else {
                        canvas.setAttribute('class', 'rotate180');
                        attrs.scale = 'fill';
                    }
                    scale = undefined;
                    scope.changePage();
                };

                scope.rotateRT = function () {
                    if (canvas.getAttribute('class') === 'rotate0') {
                        canvas.setAttribute('class', 'rotate90');
                        attrs.scale = 'rotate';
                    } else if (canvas.getAttribute('class') === 'rotate90') {
                        canvas.setAttribute('class', 'rotate180');
                        attrs.scale = 'fill';
                    } else if (canvas.getAttribute('class') === 'rotate180') {
                        canvas.setAttribute('class', 'rotate270');
                        attrs.scale = 'rotate';
                    } else {
                        canvas.setAttribute('class', 'rotate0');
                        attrs.scale = 'fill';
                    }
                    scale = undefined;
                    scope.renderPage(scope.pageToDisplay);
                };

                function clearCanvas() {
                    if (ctx) {
                        ctx.clearRect(0, 0, canvas.width, canvas.height);
                    }
                }

                function renderPDF() {
                    clearCanvas();

                    if (url && url.length) {
                        pdfLoaderTask = PDFJS.getDocument({
                            'url': url,
                            'withCredentials': creds
                        }, null, null, scope.onProgress);
                        pdfLoaderTask.then(
                            function (_pdfDoc) {
                                if (typeof scope.onLoad === 'function') {
                                    scope.onLoad();
                                }

                                pdfDoc = _pdfDoc;
                                scope.renderPage(scope.pageToDisplay);

                                scope.$apply(function () {
                                    scope.pageCount = _pdfDoc.numPages;
                                });
                            }, function (error) {
                                if (error) {
                                    if (typeof scope.onError === 'function') {
                                        scope.onError(error);
                                    }
                                }
                            }
                        );
                    }
                }

                scope.$watch('pageNum', function (newVal) {
                    scope.pageToDisplay = parseInt(newVal);
                    if (pdfDoc !== null) {
                        scope.renderPage(scope.pageToDisplay);
                    }
                });

                scope.$watch('pdfUrl', function (newVal) {
                    if (newVal !== '') {
                        if (angular.debug) {
                            console.log('pdfUrl value change detected: ', scope.pdfUrl);
                        }
                        url = newVal;
                        scope.pageToDisplay = 1;
                        if (pdfLoaderTask) {
                            pdfLoaderTask.destroy().then(function () {
                                renderPDF();
                            });
                        } else {
                            renderPDF();
                        }
                    }
                });

            }
        };
    }]);
})();


