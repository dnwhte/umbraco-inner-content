﻿// Prevalue Editors
angular.module("umbraco").controller("Our.Umbraco.InnerContent.Controllers.DocTypeTabPickerController", [

    "$scope",
    "innerContentService",

    function ($scope, innerContentService) {

        $scope.add = function () {
            $scope.model.value.push({
                icContentTypeGuid: "",
                icTabAlias: "",
                nameTemplate: ""
            });
        }

        $scope.selectedDocTypeTabs = function (cfg) {
            var dt = _.find($scope.model.docTypes, function (itm) {
                return itm.guid.toLowerCase() == cfg.icContentTypeGuid.toLowerCase();
            });
            var tabs = dt ? dt.tabs : [];
            if (!_.contains(tabs, cfg.icTabAlias)) {
                cfg.icTabAlias = tabs[0];
            }
            return tabs;
        }

        $scope.remove = function (index) {
            $scope.model.value.splice(index, 1);
        }

        $scope.sortableOptions = {
            axis: 'y',
            cursor: "move",
            handle: ".icon-navigation"
        };

        innerContentService.getContentTypes().then(function (docTypes) {
            $scope.model.docTypes = docTypes;

            // Sometimes changes in Inner Content require
            // the stored config models to be updated so we 
            // pass the models through to be pre processed
            innerContentService.preProcessModels(undefined, $scope.model.value, docTypes);
        });

        if (!$scope.model.value) {
            $scope.model.value = [];
            $scope.add();
        }
    }
]);

angular.module("umbraco").controller("Our.Umbraco.InnerContent.Controllers.DocTypePickerController", [

    "$scope",
    "innerContentService",

    function ($scope, innerContentService) {

        $scope.add = function () {
            $scope.model.value.push({
                icContentTypeGuid: "",
                nameTemplate: ""
            });
        }

        $scope.remove = function (index) {
            $scope.model.value.splice(index, 1);
        }

        $scope.sortableOptions = {
            axis: 'y',
            cursor: "move",
            handle: ".icon-navigation"
        };

        innerContentService.getContentTypes().then(function (docTypes) {
            $scope.model.docTypes = docTypes;

            // Sometimes changes in Inner Content require
            // the stored config models to be updated so we 
            // pass the models through to be pre processed
            innerContentService.preProcessModels(undefined, $scope.model.value, docTypes);

        });

        if (!$scope.model.value) {
            $scope.model.value = [];
            $scope.add();
        }
    }
]);

// Property Editors
angular.module("umbraco").controller("Our.Umbraco.InnerContent.Controllers.InnerContentDialogController",
    [
        "$scope",
        "$rootScope",
        "$interpolate",

        function ($scope, $rootScope) {
            $scope.item = $scope.model.dialogData.item;

            // Set a nodeContext property as nested property editors
            // can use this to know what doc type this node is etc
            // NC + DTGE do the same
            $scope.nodeContext = $scope.item;
        }
]);

// Directives
angular.module('umbraco.directives').directive('innerContentOverlay', [

    "$q",
    "innerContentService",

    function ($q, innerContentService) {

        function link(scope, el, attr, ctrl) {

            scope.config.editorModels = scope.config.editorModels || {};
            scope.currentItem = null;

            var getContentType = function (guid) {
                return _.find(scope.config.contentTypes, function (ct) {
                    return ct.icContentTypeGuid == guid;
                });
            }

            // Helper function to createEditorModel but at the same time
            // cache the scaffold so that if we create another item of the same
            // content type, we don't need to fetch the scaffold again
            var createEditorModel = function (contentType, dbModel) {

                var process = function (editorModel, dbModel2) {
                    var n = angular.copy(editorModel);
                    n.key = innerContentService.generateUid(); // Create new ID for item
                    return innerContentService.extendEditorModel(n, dbModel2);
                }

                if (scope.config.editorModels.hasOwnProperty(contentType.icContentTypeGuid)) {
                    var res = process(scope.config.editorModels[contentType.icContentTypeGuid], dbModel);
                    return $q.when(res);
                } else {
                    return innerContentService.createEditorModel(contentType).then(function (em) {
                        scope.config.editorModels[contentType.icContentTypeGuid] = em;
                        var res = process(scope.config.editorModels[contentType.icContentTypeGuid], dbModel);
                        return res;
                    });
                }

            }

            scope.contentTypePickerOverlay = {
                view: "itempicker",
                filter: false,
                title: "Insert Content",
                show: false,
                submit: function (model) {
                    var ct = getContentType(model.selectedItem.guid);
                    createEditorModel(ct).then(function (em) {
                        scope.currentItem = em;
                        scope.closeContentTypePickerOverlay();
                        scope.openContentEditorOverlay();
                    });
                },
                close: function () {
                    scope.closeAllOverlays();
                }
            };

            scope.contentEditorOverlay = {
                view: Umbraco.Sys.ServerVariables.umbracoSettings.appPluginsPath + "/innercontent/views/innercontent.dialog.html",
                show: false,
                submit: function (model) {
                    if (scope.config.callback) {
                        // Convert model to basic model
                        scope.config.data.model = innerContentService.createDbModel(model.dialogData.item);

                        // Notify callback
                        scope.config.callback(scope.config.data);
                    }
                    scope.closeAllOverlays();
                },
                close: function () {
                    scope.closeAllOverlays();
                }
            };

            scope.openContentTypePickerOverlay = function () {

                if (scope.contentTypePickerOverlay.availableItems.length === 0) {
                    scope.closeAllOverlays();
                    return;
                }

                if (scope.contentTypePickerOverlay.availableItems.length === 1) {
                    var ct = getContentType(scope.contentTypePickerOverlay.availableItems[0].guid);
                    createEditorModel(ct).then(function (em) {
                        scope.currentItem = em;
                        scope.openContentEditorOverlay();
                    });
                } else {
                    scope.contentTypePickerOverlay.event = scope.config.event;
                    scope.contentTypePickerOverlay.show = true;
                }

            };

            scope.closeContentTypePickerOverlay = function () {
                scope.contentTypePickerOverlay.show = false;
            };

            scope.openContentEditorOverlay = function () {
                scope.contentEditorOverlay.title = "Edit item";
                scope.contentEditorOverlay.dialogData = { item: scope.currentItem };
                scope.contentEditorOverlay.show = true;
            };

            scope.closeContentEditorOverlay = function () {
                scope.contentEditorOverlay.show = false;
            };

            scope.closeAllOverlays = function () {
                scope.closeContentTypePickerOverlay();
                scope.closeContentEditorOverlay();
                scope.config.show = false;
            };

            var initOpen = function () {

                // Map scaffolds to content type picker list
                scope.contentTypePickerOverlay.availableItems = scope.config.contentTypePickerItems;

                // Open relevant dialog
                if (!scope.config.data || !scope.config.data.model) {
                    scope.openContentTypePickerOverlay();
                } else {
                    var ct = getContentType(scope.config.data.model.icContentTypeGuid);
                    createEditorModel(ct, scope.config.data.model).then(function (em) {
                        scope.currentItem = em;
                        scope.openContentEditorOverlay();
                    });
                }

            }

            // Initialize
            if (scope.config) {

                // If overlay items haven't be initialized, then intialize them
                if (!scope.config.contentTypePickerItems) {

                    var guids = scope.config.contentTypes.map(function (itm) {
                        return itm.icContentTypeGuid;
                    });

                    innerContentService.getContentTypeInfos(guids).then(function (docTypes) {

                        // Cache items in the PE's config so we only request these once per PE instance
                        scope.config.contentTypePickerItems = docTypes;

                        initOpen();

                    });

                } else {

                    initOpen();

                }

            }
        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: Umbraco.Sys.ServerVariables.umbracoSettings.appPluginsPath + '/innercontent/views/innercontent.overlay.html',
            scope: {
                config: "="
            },
            link: link
        };

        return directive;

    }
]);

angular.module('umbraco.directives').directive('innerContentUnsavedChanges', [

    "$rootScope",

    function ($rootScope) {

        function link(scope) {

            scope.canConfirmClose = false;
            scope.showConfirmClose = false;

            // This is by no means ideal as we are overriding a core method to prevent te overlay closing
            // put without coding a custom overlay, I couldn't think of a better way of doing it. We'll
            // have to keep a close eye on the overlay api to ensure the method name doesn't change, but
            // for now it works.
            var overlayScope = scope;
            while (overlayScope.$id !== $rootScope.$id) {
                if (overlayScope.hasOwnProperty("overlayForm")) {
                    scope.canConfirmClose = true;
                    break;
                }
                overlayScope = overlayScope.$parent;
            }

            if (scope.canConfirmClose) {
                overlayScope.oldCloseOverLay = overlayScope.closeOverLay;
                overlayScope.closeOverLay = function () {
                    if (overlayScope.overlayForm.$dirty) {
                        scope.showConfirmClose = true;
                    } else {
                        overlayScope.oldCloseOverLay.apply(overlayScope);
                    }
                }
            }

            scope.confirmClose = function () {
                scope.showConfirmClose = false;
                overlayScope.oldCloseOverLay.apply(overlayScope);
            }

            scope.cancelClose = function () {
                scope.showConfirmClose = false;
            }

        }

        var directive = {
            restrict: 'E',
            replace: true,
            templateUrl: Umbraco.Sys.ServerVariables.umbracoSettings.appPluginsPath + '/innercontent/views/innercontent.unsavedchanges.html',
            link: link
        };

        return directive;

    }
]);

// Services
angular.module("umbraco").factory('innerContentService', [

    "$q",
    "$interpolate",
    "contentResource",

    "Our.Umbraco.InnerContent.Resources.InnerContentResources",

    function ($q, $interpolate, contentResource, icResources) {

        var self = {};

        var getScaffold = function (contentType) {
            return icResources.getContentTypeScaffold(contentType.icContentTypeGuid).then(function (scaffold) {

                // remove all tabs except the specified tab
                if (contentType.hasOwnProperty("icTabAlias")) {

                    var tab = _.find(scaffold.tabs, function (tab) {
                        return tab.id !== 0 && (tab.alias.toLowerCase() === contentType.icTabAlias.toLowerCase() || contentType.icTabAlias === "");
                    });
                    scaffold.tabs = [];
                    if (tab) {
                        scaffold.tabs.push(tab);
                    }

                } else {

                    // Remove general properties tab
                    scaffold.tabs.pop();

                }

                return scaffold;

            });
        }

        self.populateName = function (itm, idx, contentTypes) {

            var contentType = _.find(contentTypes, function (itm2) {
                return itm2.icContentTypeGuid === itm.icContentTypeGuid;
            });

            var nameTemplate = contentType.nameTemplate || "Item {{$index+1}}";
            var nameExp = $interpolate(nameTemplate);

            if (nameExp) {

                // Inject temporary index property
                itm.$index = idx;

                // Execute the name expression
                var newName = nameExp(itm);
                if (newName && (newName = $.trim(newName)) && itm.name !== newName) {
                    itm.name = newName;
                }

                // Remove temporary index property
                delete itm.$index;
            }

        }

        self.getContentTypes = function () {
            return icResources.getContentTypes();
        }

        self.getContentTypeInfos = function (guids) {
            return icResources.getContentTypeInfos(guids);
        }

        self.getContentTypeIcons = function (guids) {
            return icResources.getContentTypeIcons(guids);
        }

        self.createEditorModel = function (contentType, dbModel) {

            return getScaffold(contentType).then(function (scaffold) {

                scaffold.key = self.generateUid();
                scaffold.icContentTypeGuid = contentType.icContentTypeGuid;
                scaffold.name = "Untitled";

                return self.extendEditorModel(scaffold, dbModel);

            });

        }

        self.extendEditorModel = function (editorModel, dbModel) {

            editorModel.key = dbModel && dbModel.key ? dbModel.key : editorModel.key;
            editorModel.name = dbModel && dbModel.name ? dbModel.name : editorModel.name;

            if (!editorModel.key) {
                editorModel.key = self.generateUid();
            }

            if (dbModel) {
                for (var t = 0; t < editorModel.tabs.length; t++) {
                    var tab = editorModel.tabs[t];
                    for (var p = 0; p < tab.properties.length; p++) {
                        var prop = tab.properties[p];
                        if (dbModel.hasOwnProperty(prop.alias)) {
                            prop.value = dbModel[prop.alias];
                        }
                    }
                }
            }

            return editorModel;

        }

        self.createDbModel = function (model) {

            var dbModel = {
                key: model.key,
                name: model.name,
                icon: model.icon,
                icContentTypeGuid: model.icContentTypeGuid
            };

            for (var t = 0; t < model.tabs.length; t++) {
                var tab = model.tabs[t];
                for (var p = 0; p < tab.properties.length; p++) {
                    var prop = tab.properties[p];
                    if (typeof prop.value !== "function") {
                        dbModel[prop.alias] = prop.value;
                    }
                }
            }

            return dbModel;
        }

        self.createDefaultDbModel = function (contentType) {
            return self.createEditorModel(contentType).then(function (editorModel) {
                return self.createDbModel(editorModel);
            });
        }

        self.preProcessModels = function (dbModels, configContentTypes, docTypes) {

            // Pre v1.0.4 we stored the doc type alias
            // but as of 1.0.4 we switched to using the guid
            // so we remap any models which store the alias
            // to now use the guid instead

            var fixDbModels = !!dbModels && _.some(dbModels, function(m) {
                return m.hasOwnProperty("icContentTypeAlias");
            });

            var doFixDbModels = function (dbModels, docTypes) {
                _.forEach(dbModels, function (itm) {
                    if (itm.hasOwnProperty("icContentTypeAlias")) {
                        var dt = _.find(docTypes, function (itm2) {
                            return itm2.alias.toLowerCase() == itm.icContentTypeAlias.toLowerCase();
                        });
                        itm.icContentTypeGuid = dt.guid;
                        delete itm.icContentTypeAlias;
                    }
                });
            }

            var fixConfigContentTypes = !!configContentTypes && _.some(configContentTypes, function (ct) {
                return ct.hasOwnProperty("icContentTypeAlias");
            });

            var doFixConfigContentTypes = function (contentTypes, docTypes) {
                _.forEach(contentTypes, function (itm) {
                    if (model.hasOwnProperty("icContentTypeAlias")) {
                        var dt = _.find(docTypes, function (itm2) {
                            return itm2.alias.toLowerCase() == itm.icContentTypeAlias.toLowerCase();
                        });
                        itm.icContentTypeGuid = dt.guid;
                        delete itm.icContentTypeAlias;
                    }
                });
            }

            if (fixDbModels || fixConfigContentTypes) {
                if (docTypes) {
                    if (fixDbModels) {
                        doFixDbModels(dbModels, docTypes);
                    }
                    if (fixConfigContentTypes) {
                        doFixConfigContentTypes(configContentTypes, docTypes);
                    }
                } else {
                    self.getContentTypes().then(function (docTypes2) {
                        if (fixDbModels) {
                            doFixDbModels(dbModels, docTypes2);
                        }
                        if (fixConfigContentTypes) {
                            doFixConfigContentTypes(configContentTypes, docTypes2);
                        }
                    });
                }
                
            }
            
        }

        // Helpful methods
        var lut = []; for (var i = 0; i < 256; i++) { lut[i] = (i < 16 ? '0' : '') + (i).toString(16); }
        self.generateUid = function () {
            var d0 = Math.random() * 0xffffffff | 0;
            var d1 = Math.random() * 0xffffffff | 0;
            var d2 = Math.random() * 0xffffffff | 0;
            var d3 = Math.random() * 0xffffffff | 0;
            return lut[d0 & 0xff] + lut[d0 >> 8 & 0xff] + lut[d0 >> 16 & 0xff] + lut[d0 >> 24 & 0xff] + '-' +
                lut[d1 & 0xff] + lut[d1 >> 8 & 0xff] + '-' + lut[d1 >> 16 & 0x0f | 0x40] + lut[d1 >> 24 & 0xff] + '-' +
                lut[d2 & 0x3f | 0x80] + lut[d2 >> 8 & 0xff] + '-' + lut[d2 >> 16 & 0xff] + lut[d2 >> 24 & 0xff] +
                lut[d3 & 0xff] + lut[d3 >> 8 & 0xff] + lut[d3 >> 16 & 0xff] + lut[d3 >> 24 & 0xff];
        }

        return self;
    }

]);