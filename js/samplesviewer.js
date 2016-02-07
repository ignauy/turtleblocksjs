// Copyright (C) 2015 Sam Parkinson
// This program is free software; you can redistribute it and/or
// modify it under the terms of the The GNU Affero General Public
// License as published by the Free Software Foundation; either
// version 3 of the License, or (at your option) any later version.
//
// You should have received a copy of the GNU Affero General Public
// License along with this library; if not, write to the Free Software
// Foundation, 51 Franklin Street, Suite 500 Boston, MA 02110-1335 USA
//
EMPTYIMAGE = 'data:image/svg+xml;base64,' + btoa('<svg \
              xmlns="http://www.w3.org/2000/svg" width="320" height="240" \
              viewBox="0 0 320 240"></svg>')

var LOCAL_PROJECT_TEMPLATE = '\
<li data=\'{data}\' title="{title}" current="{current}"> \
    <img class="thumbnail" src="{img}" /> \
    <div class="options"> \
        <input type="text" value="{title}"/><br/> \
        <img class="open icon" title="{_("Open")}" alt="{_Open}" src="header-icons/edit.svg" /> \
        <img class="delete icon" title="{_Delete}" alt="{_Delete}" src="header-icons/delete.svg" /> \
        <img class="publish icon" title="{_Publish}" alt="{_Publish}" src="header-icons/publish.svg" /> \
        <img class="download icon" title="{_Download}" alt="{_Download}" src="header-icons/download.svg" /> \
    </div> \
</li>'

var GLOBAL_PROJECT_TEMPLATE = '\
<li url="{url}" title="{title}" couchkey="{couchkey}"> \
    <img class="thumbnail" src="{img}" /> \
    <div class="options"> \
        <span>{title}</span><br/> \
        <img class="download icon" title="{_Download}" alt="{_Download}" src="header-icons/download.svg" /> \
    </div> \
</li>';

is_nation = false;
$.couch.urlPrefix = "http://" + window.location.hostname + ":5985";

$.couch.db("configurations").allDocs({
    success: function(config) {
        config_key = config["rows"][0]["key"];
        $.couch.db("configurations").openDoc(config_key, {
            success: function(data) {
                userLang = data["currentLanguage"];
                if (data["type"] != "community") { 
                    is_nation = true;
                    $.couch.urlPrefix = "http://nation:oleoleole@" + window.location.hostname + ":5985"
                }

            }
        })
    }
});

function PlanetModel(controller) {
    this.controller = controller;
    this.localProjects = [];
    this.globalProjects = [];
    this.localChanged = false;
    this.globalImagesCache = {};
    this.updated = function() {};
    this.stop = false;
    var me = this;
    storage = localStorage;
    this.start = function(cb) {
        me.updated = cb;
        me.stop = false;

        this.redoLocalStorageData();
        me.updated();
        this.downloadWorldWideProjects();
    }

    this.downloadWorldWideProjects = function() {
        me.globalProjects = [];

        $.couch.db("resources").allDocs({
            success: function(projects) {
                projects_id = [];
                row_keys = {};
                for (var row_id in projects["rows"]) {
                    row_key = projects["rows"][row_id]["key"];
                    $.couch.db("resources").openDoc(row_key, {
                        success: function(data) {
                            if ("appName" in data) {
                                if (data["appName"] == "turtleblocksjs") {
                                    appUrl = $.couch.urlPrefix + "/resources/" + data["_id"] + "/index.html";
                                }
                            }
                            if (!("appData" in data)) {
                                return
                            };
                            if (data["appData"] != "turtleblocksjs") {
                                return
                            };

                            var project = data["project"]
                            project_name = project[0];
                            project_data = project[1];
                            project_img = project[2];
                            me.globalImagesCache[project_name] = project_img;

                            me.globalProjects.push({
                                couchkey: data["_id"],
                                title: project_name,
                                img: project_img
                            });

                            me.updated();
                        }
                    });
                }
            }
        });
    }

    this.redoLocalStorageData = function() {
        this.localProjects = [];
        var l = JSON.parse(storage.allProjects);
        l.forEach(function(p, i) {
            var img = storage['SESSIONIMAGE' + p];
            if (img === 'undefined') {
                img = EMPTYIMAGE;
            }

            var e = {
                title: p,
                img: img,
                data: storage['SESSION' + p],
                current: p === storage.currentProject
            }

            if (e.current) {
                me.localProjects.unshift(e);
            } else {
                me.localProjects.push(e);
            }
        });
        this.localChanged = true;
    }

    this.uniqueName = function(base) {
        var l = JSON.parse(storage.allProjects);
        if (l.indexOf(base) === -1) {
            return base;
        }

        var i = 1;
        while (true) {
            var name = base + ' ' + i;
            if (l.indexOf(name) === -1) {
                return name;
            }
            i++;
        }
    }

    this.newProject = function() {
        var name = this.uniqueName('My Project');
        me.prepLoadingProject(name);
        this.controller.sendAllToTrash(true, true);
        me.stop = true;
    }

    this.renameProject = function(oldName, newName, current) {
        if (current) {
            storage.currentProject = newName;
        }

        var l = JSON.parse(storage.allProjects);
        l[l.indexOf(oldName)] = newName;
        storage.allProjects = JSON.stringify(l);

        storage['SESSIONIMAGE' + newName] =
            storage['SESSIONIMAGE' + oldName];
        storage['SESSION' + newName] = storage['SESSION' + oldName];

        storage['SESSIONIMAGE' + oldName] = undefined;
        storage['SESSION' + oldName] = undefined;

        me.redoLocalStorageData();
    }

    this.delete = function(name) {
        var l = JSON.parse(storage.allProjects);
        l.splice(l.indexOf(name), 1);
        storage.allProjects = JSON.stringify(l);

        storage['SESSIONIMAGE' + name] = undefined;
        storage['SESSION' + name] = undefined;

        me.redoLocalStorageData();
        me.updated();
    }

    this.open = function(name, data) {
        storage.currentProject = name;
        me.controller.sendAllToTrash(false, true);
        me.controller.loadRawProject(data);
        me.stop = true;
    }

    this.prepLoadingProject = function(name) {
        storage.currentProject = name;

        var l = JSON.parse(storage.allProjects);
        l.push(name);
        storage.allProjects = JSON.stringify(l);
    }

    this.load = function(db_key) {
        $.couch.db("resources").openDoc(db_key, {
            success: function(data) {
                project = data["project"]
                project_name = project[0];
                project_data = project[1];

                me.prepLoadingProject(me.uniqueName(project_name));
                me.controller.sendAllToTrash(false, false);
                me.controller.loadRawProject(project_data);
                me.stop = true;
            }
        });
    }

    this.publish = function(name, data, image) {
        var _id = $.couch.newUUID();

        redirect = Base64.encode("<script>window.location.assign('" + appUrl + "?file=" + _id + "')</script>");

        /* Create the collection 'turtleblocksjs' */

        collection = {
           _id: "turtleblocksjs",
           kind: "CollectionList",
           IsMajor: true,
           show: true,
           CollectionName: "TurtleBlocksJS Projects",
           Description: "TurtleBlocksJS projects made by community",
        }

        $.couch.db("collectionlist").saveDoc(collection, {
            success: function(status) {
            },
            error: function(status) {
            }
        });

        var resource = {
            _id: _id,
            kind: "Resource",
            title: "TurtleJS Project - '" + name + "'",
            author: "todo: username",
            openWith: "HTML",
            appData: "turtleblocksjs",
            subject: [
                "Technology"
            ],
            Level: [
                "Professional"
            ],
            project: [name, data, image],
            language: userLang,
            rewrites: [{
                from: "/",
                to: 'index.html'
            }, {
                from: "/*",
                to: '*'
            }],
            _attachments: {
                "index.html": {
                    "content_type": "text/html",
                    "data": redirect
                }
            },
            Tag: [ "turtleblocksjs"]
        };


        $.couch.db("resources").saveDoc(resource, {
            success: function(status) {
                console.log(status);
                me.downloadWorldWideProjects();
            }
        });


    }
}

function PlanetView(model, controller) {
    this.model = model;
    this.controller = controller;
    var me = this; // for future reference

    document.querySelector('.planet .new')
        .addEventListener('click', function() {
            me.model.newProject();
            me.controller.hide();
        });

    document.querySelector('#myOpenFile')
        .addEventListener('change', function(event) {
            me.controller.hide();
        });
    document.querySelector('.planet .open')
        .addEventListener('click', function() {
            document.querySelector('#myOpenFile').focus();
            document.querySelector('#myOpenFile').click();
            window.scroll(0, 0);
        });

    this.update = function() {
        // This is werid
        var model = this;

        if (model.localChanged) {
            html = '';
            model.localProjects.forEach(function(project, i) {
                html = html + format(LOCAL_PROJECT_TEMPLATE, project);
            });
            document.querySelector('.planet .content.l').innerHTML = html;

            var eles = document.querySelectorAll('.planet .content.l li');
            Array.prototype.forEach.call(eles, function(ele, i) {
                ele.querySelector('.open')
                    .addEventListener('click', me.open(ele));
                ele.querySelector('.publish')
                    .addEventListener('click', me.publish(ele));
                ele.querySelector('.download')
                    .addEventListener('click', me.download(ele));
                ele.querySelector('.delete')
                    .addEventListener('click', me.delete(ele));
                ele.querySelector('input')
                    .addEventListener('change', me.input(ele));
                ele.querySelector('.thumbnail')
                    .addEventListener('click', me.open(ele));
            });
            model.localChanged = false;
        }

        html = '';
        model.globalProjects.forEach(function(project, i) {
            html += format(GLOBAL_PROJECT_TEMPLATE, project);
        });
        document.querySelector('.planet .content.w').innerHTML = html;

        var eles = document.querySelectorAll('.planet .content.w li');
        Array.prototype.forEach.call(eles, function(ele, i) {
            ele.addEventListener('click', me.load(ele))
        });
    }

    this.load = function(ele) {
        return function() {
            document.querySelector('#loading-image-container')
                .style.display = '';

            me.model.load(ele.attributes.couchkey.value);
            me.controller.hide();
        }
    }

    this.publish = function(ele) {
        return function() {
            document.querySelector('#loading-image-container')
                .style.display = '';
            me.model.publish(ele.attributes.title.value,
                ele.attributes.data.value,
                ele.querySelector('img').src);
            document.querySelector('#loading-image-container')
                .style.display = 'none';
        }
    }

    this.download = function(ele) {
        return function() {
            download(ele.attributes.title.value + '.tb',
                'data:text/plain;charset=utf-8,' + ele.attributes.data.value);
        }
    }

    this.open = function(ele) {
        return function() {
            if (ele.attributes.current.value === 'true') {
                me.controller.hide();
                return;
            }

            me.model.open(ele.attributes.title.value,
                ele.attributes.data.value);
            me.controller.hide();
        }
    }

    this.delete = function(ele) {
        return function() {
            var title = ele.attributes.title.value;
            me.model.delete(title);
        }
    }

    this.input = function(ele) {
        return function() {
            var newName = ele.querySelector('input').value;
            var oldName = ele.attributes.title.value;
            var current = ele.attributes.current.value === 'true';
            me.model.renameProject(oldName, newName, current);
            ele.attributes.title.value = newName;
        }
    }
}

// A viewer for sample projects
function SamplesViewer(canvas, stage, refreshCanvas, load, loadRawProject, trash) {
    this.stage = stage;
    this.sendAllToTrash = trash;
    this.loadProject = load;
    this.loadRawProject = loadRawProject;
    var me = this; // for future reference

    // i18n for section titles
    document.querySelector("#planetTitle").innerHTML = _("Planet");
    document.querySelector("#planetMyDevice").innerHTML = _("On my device");
    document.querySelector("#planetWorldwide").innerHTML = _("Worldwide");

    this.model = new PlanetModel(this);
    this.view = new PlanetView(this.model, this);

    this.setServer = function(server) {
        this.server = server;
    }

    this.hide = function() {
        document.querySelector('.planet').style.display = 'none';
        document.querySelector('body').classList.remove('samples-shown');
        document.querySelector('.canvasHolder').classList.remove('hide');
        document.querySelector('#theme-color').content = platformColor.header;
        me.stage.enableDOMEvents(true);
        window.scroll(0, 0);
    }

    this.show = function() {
        document.querySelector('.planet').style.display = '';
        document.querySelector('body').classList.add('samples-shown');
        document.querySelector('.canvasHolder').classList.add('hide');
        document.querySelector('#theme-color').content = '#8bc34a';
        setTimeout(function() {
            // Time to release the mouse
            me.stage.enableDOMEvents(false);
        }, 250);
        window.scroll(0, 0);

        this.model.start(this.view.update);
        return true;
    }
}

function validateImageData(d) {
    if (d === undefined) {
        return false;
    }

    if (d.indexOf('data:image') !== 0) {
        return false;
    } else {
        var data = d.split(",");
        if (data[1].length === 0) {
            return false;
        }
    }
    return true;
}
