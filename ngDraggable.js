/*
 *
 * https://github.com/fatlinesofcode/ngDraggable
 */

var _inputEvent = function(event) {
    if (angular.isDefined(event.touches)) {
        return event.touches[0];
    }
    //Checking both is not redundent. If only check if touches isDefined, angularjs isDefnied will return error and stop the remaining scripty if event.originalEvent is not defined.
    else if (angular.isDefined(event.originalEvent) && angular.isDefined(event.originalEvent.touches)) {
        return event.originalEvent.touches[0];
    }
    return event;
};

var _isClickableElement = function (event) {
    return (
        angular.isDefined(angular.element(event.target).attr("ng-cancel-drag"))
    );
};

var _dragData = null;

angular.module("ngDraggable", [])
    .directive('ngDrag', ['$rootScope', '$parse', '$document', '$window', '$templateRequest', '$compile', function ($rootScope, $parse, $document, $window, $templateRequest, $compile) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {

                var onDragStartCallback   = $parse(attrs.ngDragStart) || null;
                var onDragStopCallback    = $parse(attrs.ngDragStop) || null;
                var onDragSuccessCallback = $parse(attrs.ngDragSuccess) || null;
                var getDragData           = $parse(attrs.ngDragData);
                var clone                 = scope.$eval(attrs.ngDragClone);
                var cloneTemplate         = angular.isString(clone) ? clone : null;
                var snapping              = attrs.ngDragSnap || 10;

                // Get clone template and compile to dom node
                if (cloneTemplate) {
                    $templateRequest(cloneTemplate).then(function(template){
                        cloneTemplate = $compile(template)(scope);
                    });
                }

                var offset,
                    _cloneNode,
                    _mx,
                    _my,
                    _tx,
                    _ty,
                    _mrx,
                    _mry;
                var _hasTouch = ('ontouchstart' in window) || window.DocumentTouch && document instanceof DocumentTouch;
                var _pressEvents = 'touchstart mousedown';
                var _moveEvents = 'touchmove mousemove';
                var _releaseEvents = 'touchend mouseup';
                var _dragHandle;

                // to identify the element in order to prevent getting superflous events when a single element has both drag and drop directives on it.
                var _myid = scope.$id;
                var _data = null;
                var _dragging = false;
                var _dragOffset = null;
                var _dragOffset = null;
                var _dragOffset = null;
                var _dragOffset = null;
                var _dragEnabled = false;
                var _pressTimer = null;


                // deregistration function for mouse move events in $rootScope triggered by jqLite trigger handler
                var _deregisterRootMoveListener = angular.noop;

                var initialize = function () {
                    element.attr('draggable', 'false'); // prevent native drag

                    scope.$watch(attrs.ngDrag, function (newVal, oldVal) {
                        _dragEnabled = newVal;
                    });

                    // check to see if drag handle(s) was specified
                    var dragHandles = angular.element(element[0].querySelectorAll('[ng-drag-handle]'));
                    if (dragHandles.length) {
                        dragHandles.on(_pressEvents, onpress);
                    } else {
                        element.on(_pressEvents, onpress);
                    }

                    if(! _hasTouch && element[0].nodeName.toLowerCase() == "img"){
                        element.on('mousedown', function(){ return false;}); // prevent native drag for images
                    }
                };

                /*
                 * When the element is clicked start the drag behaviour
                 * On touch devices as a small delay so as not to prevent native window scrolling
                 */
                var onpress = function(evt) {
                    if(! _dragEnabled || _isClickableElement(evt)) return;

                    // Do not start dragging on right-click
                    if (evt.type == "mousedown" && evt.button != 0) {
                        return;
                    }

                    if(_hasTouch) {
                        cancelPress();
                        _pressTimer = setTimeout(function(){
                            cancelPress();
                            onlongpress(evt);
                        },100);
                        $document.on(_moveEvents, cancelPress);
                        $document.on(_releaseEvents, cancelPress);
                    } else {
                        onlongpress(evt);
                    }
                };

                var cancelPress = function() {
                    clearTimeout(_pressTimer);
                    $document.off(_moveEvents, cancelPress);
                    $document.off(_releaseEvents, cancelPress);
                };

                var onlongpress = function(evt) {
                    if(! _dragEnabled)return;
                    evt.preventDefault();

                    offset = element[0].getBoundingClientRect();
                    _dragOffset = offset;
                    _dragOffset = offset;
                    _dragOffset = offset;
                    _dragOffset = offset;

                    element.centerX = element[0].offsetWidth / 2;
                    element.centerY = element[0].offsetHeight / 2;

                    _mx = _inputEvent(evt).pageX;//ngDraggable.getEventProp(evt, 'pageX');
                    _my = _inputEvent(evt).pageY;//ngDraggable.getEventProp(evt, 'pageY');
                    _mrx = _mx - offset.left;
                    _mry = _my - offset.top;
                    _tx = _mx - _mrx - $window.pageXOffset;
                    _ty = _my - _mry - $window.pageYOffset;

                    $document.on(_moveEvents, onmove);
                    $document.on(_releaseEvents, onrelease);

                    // This event is used to receive manually triggered mouse move events
                    // jqLite unfortunately only supports triggerHandler(...)
                    // See http://api.jquery.com/triggerHandler/
                    // _deregisterRootMoveListener = $rootScope.$on('draggable:_triggerHandlerMove', onmove);
                    _deregisterRootMoveListener = $rootScope.$on('draggable:_triggerHandlerMove', function(event, origEvent) {
                        onmove(origEvent);
                    });
                };

                var onmove = function (evt) {
                    // Check delta to determine a on drag
                    var delta = Math.round(Math.sqrt(Math.pow(Math.abs(_inputEvent(evt).pageX - _mx),2)+Math.pow(Math.abs(_inputEvent(evt).pageY - _my), 2)));
                    if (_dragging || delta > snapping) {
                        _dragging = true;
                        ondrag(evt);
                    }
                };

                var ondrag = function(evt){
                    if (!_dragEnabled)return;
                    evt.preventDefault();

                    if (!element.hasClass('dragging')) {
                        element.addClass('dragging');
                        _dragData = scope.dragData = _data = getDragData(scope);

                        $rootScope.$broadcast('draggable:start', {x:_mx, y:_my, tx:_tx, ty:_ty, event:evt, element:element, data:_data});
                        onDragStartCallback && onDragStartCallback(scope, {$data: _data, $event: evt});

                        if (clone) {
                            if (cloneTemplate) {
                                _cloneNode = cloneTemplate.css({
                                    position : 'fixed',
                                    top      : 0,
                                    left     : 0,
                                    'z-index': 99999,
                                })
                            } else {
                                // Create clone on root
                                _cloneNode = angular.element(element[0].cloneNode(true))
                                .removeAttr('ng-drag')
                                .removeAttr('ng-drag-data')
                                .removeAttr('draggable')
                                .removeAttr('ng-drag-clone')
                                .addClass('ng-drag-clone')
                                .css({
                                    position : 'fixed',
                                    top      : 0,
                                    left     : 0,
                                    width    : offset.width+'px',
                                    height   : offset.height+'px',
                                    'z-index': 99999,
                                });
                            }

                            // Attach clone
                            document.body.appendChild(_cloneNode[0]);
                        }
                    }

                    if (clone) {
                        var cloneOffset = _cloneNode[0].getBoundingClientRect();
                    }

                    _mx = _inputEvent(evt).pageX;//ngDraggable.getEventProp(evt, 'pageX');
                    _my = _inputEvent(evt).pageY;//ngDraggable.getEventProp(evt, 'pageY');

                    if ( ! clone) {
                        _tx = _mx - _mrx - _dragOffset.left;
                        _ty = _my - _mry - _dragOffset.top;
                    } else {
                        _tx = Math.round(_mx - cloneOffset.width / 2);
                        _ty = Math.round(_my - cloneOffset.height / 2);
                    }

                    moveElement(_tx, _ty);

                    $rootScope.$broadcast('draggable:move', { x: _mx, y: _my, tx: _tx, ty: _ty, event: evt, element: element, data: _data, uid: _myid, dragOffset: _dragOffset });
                };

                var onrelease = function(evt) {
                    _dragData = scope.dragData = null;
                    _dragging = false;
                    evt.preventDefault();
                    if (_dragEnabled && element.hasClass('dragging')) {
                        $rootScope.$broadcast('draggable:end', {x:_mx, y:_my, tx:_tx, ty:_ty, event:evt, element:element, data:_data, callback:onDragComplete, uid: _myid});
                        element.removeClass('dragging');
                        element.parent().find('.drag-enter').removeClass('drag-enter');
                        reset();
                        if (onDragStopCallback ){
                            scope.$apply(function () {
                                onDragStopCallback(scope, {$data: _data, $event: evt});
                            });
                        }
                    }

                    $document.off(_moveEvents, onmove);
                    $document.off(_releaseEvents, onrelease);
                    _deregisterRootMoveListener();
                };

                var onDragComplete = function(evt) {

                    if (!onDragSuccessCallback )return;

                    scope.$apply(function () {
                        onDragSuccessCallback(scope, {$data: _data, $event: evt});
                    });
                };

                var reset = function() {
                    element.css({transform:'', 'z-index':''});

                    if (clone && _cloneNode) {
                        document.body.removeChild(_cloneNode[0]);
                        _cloneNode = null;
                    }
                };

                var moveElement = function (x, y) {
                    if ( ! clone) {
                        element.css({
                            transform: 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ' + x + ', ' + y + ', 0, 1)',
                            'z-index': 99999,
                        });
                    } else {
                        _cloneNode.css({
                            transform: 'matrix3d(1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, ' + x + ', ' + y + ', 0, 1)',
                            'z-index': 99999,
                        })
                    }
                };
                initialize();
            }
        };
    }])

    .directive('ngDrop', ['$parse', '$window', '$document', function ($parse, $window, $document) {
        return {
            restrict: 'A',
            link: function (scope, element, attrs) {
                scope.isTouching = false;

                var _lastDropTouch=null;

                var _myid = scope.$id;

                var _dropEnabled=false;

                var onDropCallback = $parse(attrs.ngDropSuccess);// || function(){};

                var onDragStartCallback = $parse(attrs.ngDragStart);
                var onDragStopCallback = $parse(attrs.ngDragStop);
                var onDragMoveCallback = $parse(attrs.ngDragMove);

                var initialize = function () {
                    toggleListeners(true);
                };

                var toggleListeners = function (enable) {
                    // remove listeners

                    if (!enable)return;

                    scope.$on('$destroy', onDestroy);
                    scope.$on('draggable:start', onDragStart);
                    scope.$on('draggable:move', onDragMove);
                    scope.$on('draggable:end', onDragEnd);
                };

                var onDestroy = function (enable) {
                    toggleListeners(false);
                };
                var onDragStart = function(evt, obj) {
                    // Compute _dropEnabled
                    _dropEnabled = $parse(attrs.ngDrop)(scope, {$data : _dragData});
                };
                var onDragMove = function(evt, obj) {
                    if( ! _dropEnabled) return;

                    if (isTouching(obj.x,obj.y,obj.element)) {
                        // Move callback
                        onDragMoveCallback && onDragMoveCallback(scope, {$data: obj.data, $event: obj});
                    }

                };

                var onDragEnd = function (evt, obj) {
                    // don't listen to drop events if this is the element being dragged
                    // only update the styles and return
                    if ( ! _dropEnabled || _myid === obj.uid) {
                        updateDragStyles(false, obj.element);
                        return;
                    }
                    if (isTouching(obj.x, obj.y, obj.element)) {
                        // call the ngDraggable ngDragSuccess element callback
                        obj.callback && obj.callback(obj);
                        onDropCallback && onDropCallback(scope, {$data: obj.data, $event: obj});
                    }

                    updateDragStyles(false, obj.element);

                    onDragStopCallback && onDragStopCallback(scope, {$data: obj.data, $event: obj});
                };

                var isTouching = function(mouseX, mouseY, dragElement) {
                    var touching= hitTest(mouseX, mouseY);
                    scope.isTouching = touching;
                    if(touching){
                        _lastDropTouch = element;
                    }
                    updateDragStyles(touching, dragElement);
                    return touching;
                };

                var updateDragStyles = function(touching, dragElement) {
                    if(touching){
                        element.addClass('drag-enter');
                        dragElement.addClass('drag-over');
                    }else if(_lastDropTouch == element){
                        _lastDropTouch=null;
                        element.removeClass('drag-enter');
                        dragElement.removeClass('drag-over');
                    }
                };

                var hitTest = function(x, y) {
                    var bounds = element[0].getBoundingClientRect();// ngDraggable.getPrivOffset(element);
                    x -= $document[0].body.scrollLeft + $document[0].documentElement.scrollLeft;
                    y -= $document[0].body.scrollTop + $document[0].documentElement.scrollTop;
                    return  x >= bounds.left
                        && x <= bounds.right
                        && y <= bounds.bottom
                        && y >= bounds.top;
                };

                initialize();
            }
        };
    }]);
