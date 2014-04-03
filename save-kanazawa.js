var casper, rosenList, fs;
var imgidx = 0;

casper = require("casper").create({
	verbose: !true
	, logLevel: "debug"
});
casper.userAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_9_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/33.0.1750.152 Safari/537.36");

fs = require("fs");

// 時刻表メニューから路線検索画面へ（リファラ付与）
casper.start("http://arj.hokutetsu.co.jp/timetable/menu.php");
casper.then(function() {
	captureAndLog("going to rosen search");
	this.click("a[href$='busline.php']");
});

// 路線一覧を取得
casper.waitFor(isLoaderHidden, function() {
	captureAndLog("parsing rosen list");

	rosenList = this.evaluate(function() {
		var options = document.querySelectorAll("#ros_list > option");
		return Array.prototype.map.call(options, function(e) {
			return { name: e.innerText };
		});
	});

	// for test
	// rosenList = rosenList.slice(0, 2);
	
	nextRosen();
});

function nextRosen() {
	var rosen, optionList;

	if (rosenList.length === 0) {
		return;
	}

	console.log("#1 " + casper.getTitle());
	
	rosen = rosenList.shift();
	optionList = [
		{ label: "下り-平日", clickSelector: null }
		, { label: "下り-土曜日", clickSelector: "[name='weekday'][value='1']" }
		, { label: "下り-日祝", clickSelector: "[name='weekday'][value='2']" }
		, { label: "上り-日祝", clickSelector: "[name='ofukukbn'][value='2']" }
		, { label: "上り-土曜日", clickSelector: "[name='weekday'][value='1']" }
		, { label: "上り-平日", clickSelector: "[name='weekday'][value='0']" }
	];
	console.log(rosen.name);

	casper.fill("form[action$='busline_timetable.php']", { ros_mei: rosen.name }, true);
	casper.waitFor(isLoaderHidden, nextOption);

	function nextOption() {
		var option, params, table, pages;

		if (optionList.length === 0) {
			// back to line list
			casper.click("a[href$='busline.php']");
			casper.waitFor(isLoaderHidden, nextRosen);
			return;
		}

		option = optionList.shift();
		table = null;
		pages = 1;
		console.log("    " + option.label);

		captureAndLog("next option: " + option.label);

		if (option.clickSelector) {
			casper.click(option.clickSelector);
			casper.waitFor(isLoaderHidden, parseTable);
		}
		else {
			parseTable.call(this);
		}
		
		function parseTable() {
			captureAndLog("parsing table (page " + pages + ")");

			if (casper.getTitle().indexOf("エラー") >= 0) {
				casper.die("FAIL", 1);
			}

			var part = casper.evaluate(function getTableData() {
				var rows = document.querySelectorAll("table.busline tr");
				return Array.prototype.map.call(rows, function(row) {
					var cols = row.querySelectorAll("th, td");
					return Array.prototype.map.call(cols, function(col) {
						return col.innerText;
					});
				});
			});

			// merge table
			if (! table) {
				table = part;
			}
			else {
				table.forEach(function(item, index) {
					if (Array.isArray(part[index])) {
						table[index] = table[index].concat( part[index].slice(1) );
					}
				});
			}

			// go to next page
			if (casper.exists("#arrowf a#next")) {
				pages++;
				casper.click("#arrowf a#next");
				casper.waitFor(isLoaderHidden, parseTable);
			}
			// go to next option
			else {
				finishOption();
			}
		}

		function finishOption() {
			var text = table.map(function(row) {
				return row.join("\t");
			}).join("\n");
			fs.write("data/" + rosen.name + "-" + option.label + ".tsv", text, "w");
			
			nextOption();
		}
	}
}

function cleanStr(str) {
	return str.replace(/[\t\n]+/g, " ").replace(/^\s+|\s+$/g, "");
}

function isLoaderHidden() {
	return this.evaluate(function() {
		return document.querySelector("#loader").style.display == "none";
	});
}

function getFormValues() {
	var data = {}, els, form;
	form = document.forms[0];
	els = form.querySelectorAll("input, select, textarea");
	Array.prototype.forEach.call(els, function(el) {
		var name = el.getAttribute("name");
		var value = el.value;
		var type = el.getAttribute("type");
		if (typeof name === "undefined" ||
			el.getAttribute("disabled") ||
			el.tagName.toLowerCase() === "input" && (type === "checkbox" || type === "radio") && !el.checked) {
			return;
		}
		if (name in data) {
			if (data[name] instanceof Array) {
				data[name].push(value);
			}
			else {
				data[name] = [data[name], value];
			}
		}
		else {
			data[name] = value;
		}
	});
	return data;
}

function captureAndLog(message) {
//	console.log(imgidx + ".png: " + message);
//	casper.capture("logimg/" + imgidx + ".png");
	imgidx++;
}

casper.run();
