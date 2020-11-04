angular.module('index', ['ng'])
    .controller('IndexController', ['$http', '$location', '$scope', '$window', '$timeout',
        function ($http, $location, $scope, window, $timeout, FILES_BASE_URL) {
            var self = this;

            this.config = null;
            this.sort = {
                rev: false,
                name: null,
                reset: function () {
                    this.rev = false;
                    this.name = null;

                    this.save();
                },
                toggle: function (col, rev) {
                    if (this.name == col) {
                        this.rev = !this.rev;
                    } else {
                        this.name = col;
                        this.rev = rev;
                    }

                    this.save();
                },
                save: function () {
                    window.localStorage.setItem('sortName', this.name || '');
                    window.localStorage.setItem('sortRev', this.rev ? '1' : '');
                },
                load: function () {
                    this.name = window.localStorage.getItem('sortName');
                    this.rev = !!window.localStorage.getItem('sortRev');
                }
            };

            this.files = [];

            this.loading = {
                running: false,
                timer: null,
                start: function (timeout) {
                    if (timeout == undefined) { timeout = 500; }

                    var self = this;
                    this.stop();

                    if (timeout > 0) {
                        this.timer = $timeout(function () {
                            self.running = true;
                        }, timeout);
                    } else {
                        this.running = true;
                    }
                },
                stop: function () {
                    this.timer && $timeout.cancel(this.timer);
                    this.timer = null;
                    this.running = false;
                }
            };

            this.go_up = function () {
                var lastSlash = self.path.lastIndexOf('/');
                if (lastSlash < 0) {
                    $location.path('');
                } else {
                    $location.path(self.path.substring(0, lastSlash));
                }
            };

            this.reloading = {
                running: false,
                start: function (timeout) {
                    this.timer && $timeout.cancel(this.timer);
                    this.running = true;

                    var self = this;
                    this.timer = $timeout(function () {
                        self.running = false;
                    }, timeout || 1000);
                }
            };

            this.reload = function () {
                self.reloading.start();
                load_folder(self.path);
            };

            function load_folder(path) {
                self.error = null;
                self.loading.start();

                return $http({
                    method: 'GET',
                    url: self.config.base_index_url + (path || '') + (self.config.tail_slash ? '/' : '')
                }).then(function (response) {
                    var files = response.data || [];

                    for (var i = 0, l = files.length; i < l; i++) {
                        files[i].mtime = new Date(files[i].mtime);
                    }

                    self.files = files;
                    self.loading.stop();

                    window.localStorage.setItem('lastPath', path);
                    window.scrollTo(0, 0);
                }, function (response) {
                    self.error = response;
                    self.loading.stop();
                    window.scrollTo(0, 0);
                });
            }

            function path_parts(path) {
                var parts = (path == '/' ? '' : path).split('/'), up = '', path;
                for (var i = 0, l = parts.length; i < l; i++) {
                    path = up + parts[i];
                    up = path + '/';
                    parts[i] = { path: path, name: parts[i] || '‹root›' };
                }
                return parts;
            }

            function initialize(config) {
                self.sort.load();
                self.loading.start();

                $http({
                    url: config || 'config.json',
                    method: 'GET'
                }).then(function (response) {
                    self.loading.stop();

                    self.config = response.data || {
                        page_title: "Files Index",
                        base_index_url: "",
                        tail_slash: false,
                        default_sort: { name: null, rev: false }
                    };

                    self.sort.name = self.config.default_sort.name;
                    self.sort.rev = self.config.default_sort.rev;

                    $scope.$on('$locationChangeSuccess', function () {
                        self.path_parts = path_parts(self.path = $location.path());
                        if (self.path == '/') self.path = '';
                        load_folder(self.path);
                    });

                    var path;
                    if ($location.path() == '' && (path = window.localStorage.getItem('lastPath'))) {
                        $location.path(path);
                    } else {
                        $scope.$broadcast('$locationChangeSuccess');
                    }

                }, function (response) {
                    self.loading.stop();
                    self.error = response;
                });
            }

            initialize($location.search().config);
        }])
    .controller('ScrollToTopController', ['$window', '$scope', function (window, $scope) {
        var self = this;
        this.show = false;

        var scrollDebounce = null;
        window.addEventListener('scroll', function () {
            scrollDebounce && clearTimeout(scrollDebounce);
            self.show = window.scrollY > 150;
            scrollDebounce = setTimeout(function () {
                $scope.$digest();
            }, 500);
        });

        var scrollTicker;
        this.to_top = function () {
            scrollTicker && clearInterval(scrollTicker);

            scrollTicker = setInterval(function () {
                var y = 0.6 * window.scrollY;
                if (y < 100) {
                    y = 0;
                    clearInterval(scrollTicker);
                }

                window.scrollTo(0, y);
            }, 10);
        };
    }])
    .filter('humanize', function () {
        return function humanize(number) {
            if (number < 1024) {
                return number + ' bytes';
            }
            var si = ['K', 'M', 'G', 'T', 'P', 'H'];
            var exp = Math.floor(Math.log(number) / Math.log(1024));
            var result = number / Math.pow(1024, exp);
            result = (result % 1 > (1 / Math.pow(1024, exp - 1))) ? result.toFixed(2) : result.toFixed(0);
            return result + ' ' + si[exp - 1] + 'ib';
        };
    });