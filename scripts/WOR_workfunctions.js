﻿
// convert degrees to radians
function degToRad(deg) {
	return deg * Math.PI * 2 / 360;
}

// convert radians to degrees
function radToDeg(rad) {
	return rad * 360 / (Math.PI * 2);
}

function returnRoundedStr(val){ //returns rounded as string to one decimal, with zero.
    var retval = Math.round( val * 10 ) / 10;
    return retval.toFixed(1);
}

function getRandomInt(min, max) {
	min = Math.ceil(min);
	max = Math.floor(max);
	return Math.floor(Math.random() * (max - min)) + min;
}

function calcSinCosFromAngle(xy, angle, radius) { //requires ('x' or 'y'), angle in degrees and radius in px.
	var SinCos;
	if (xy === 'x') SinCos = radius * Math.cos(angle); // Calculate the x position of the element.
	if (xy === 'y') SinCos = radius * Math.sin(angle); // Calculate the y position of the element.
	return SinCos;
}

var getDistanceFromCoords = function (lonlat1, lonlat2) { //returns distance in nautical miles between 2 points. format: lonlatX=[xx.xx,xx.xx]
	var wgs84Sphere = new ol.Sphere(6378137); //define spherical math layout
	var length;
	var coordinates = []; coordinates.push(lonlat1); coordinates.push(lonlat2);
	length = 0;
	var sourceProj = map.getView().getProjection();
	for (var i = 0, ii = coordinates.length - 1; i < ii; ++i) {
		var c1 = ol.proj.transform(coordinates[i], sourceProj, 'EPSG:3857');
		var c2 = ol.proj.transform(coordinates[i + 1], sourceProj, 'EPSG:3857');
		length += wgs84Sphere.haversineDistance(c1, c2);
	}
	var output = length * 0.539956803;
	output = (Math.round(output / 1000 * 100) / 100);
	return output;
};


function calculateAndSaveDistanceBetweenRouteMarkers() { //saves distance between markers to handle zooming behaviour of route weathermarkers
	for (var i = 0; i !== route.waypoints.length-1; i++) {
		var thiswaypoint = [route.waypoints[i].lon, route.waypoints[i].lat],
			nextwaypoint = [route.waypoints[i+1].lon, route.waypoints[i+1].lat];
		route.extensions.weathermarkersettings[i].nextwaypointdistance = getDistanceFromCoords(thiswaypoint, nextwaypoint);
	}
}


function updateRouteWORMFunction(id) { //create route weather marker when data is available.
	var winddirection = route.extensions.weatherdata[id].forecasts[0].winddir.forecast;
	var windspeed = route.extensions.weatherdata[id].forecasts[0].windspeed.forecast;
	var currentdirection = route.extensions.weatherdata[id].forecasts[0].currentdir.forecast;
	var currentspeed = route.extensions.weatherdata[id].forecasts[0].currentspeed.forecast;
	var wavedirection = route.extensions.weatherdata[id].forecasts[0].wavedir.forecast;
	var waveheight = route.extensions.weatherdata[id].forecasts[0].waveheight.forecast;

	var timehours = (route.scheduleElement[id].eta.split("T")[1]).split(".")[0]; //get hours & minutes from 2017-04-19T11:00:01.000Z
	timehours = timehours.substring(0,timehours.length-3);
	var markertext = retDayFromRTZ(route.scheduleElement[id].eta) + "\n" + timehours + " UTC";
	if (!control_displaymarkertext) markertext = "";

	//adds a new marker with updated info
	mapSource.addFeatures(generateWORM('ROUTEWEATHERMARKER', 'routeweathermarker_' + id, route.waypoints[id].lon, route.waypoints[id].lat, control_scale, winddirection, windspeed, currentdirection, currentspeed, wavedirection, waveheight, markertext));
}

function updateRouteWORMTextFunction(id) { //creates the text under a WORM
    if(route.extensions.weathermarkersettings[id].visible === true){
        var timehours = (route.scheduleElement[id].eta.split("T")[1]).split(".")[0]; //get hours & minutes from 2017-04-19T11:00:01.000Z
        timehours = timehours.substring(0,timehours.length-3);
        var markertext = retDayFromRTZ(route.scheduleElement[id].eta) + "\n" + timehours + " UTC";
        if (!control_displaymarkertext) markertext = "";
        mapSource.addFeatures(generateWORMText('ROUTEMARKERTEXT', 'routemarkertext_' + id, route.waypoints[id].lon, route.waypoints[id].lat, control_scale, markertext));
    }else{
        try{
            mapSource.removeFeature(mapSource.getFeatureById("routemarkertext_" + (id))); //removes WORM text
        }catch(noMarkerTextToRemove){}
    }
}



//test route weathermarkers for overlapping on zoom, remove the lowest overlapping one in order from start to end
function cleanWeatherMarkersOverlapping() {
	function hideshowmarkerswithindistance(showhidedistance) {
		var totalDistance = 0;
		for (var i = 0; i !== route.extensions.weathermarkersettings.length - 1; i++) {//loop through all waypoints, remove any that are closer than (distance)
			for (var y = i; y !== route.extensions.weathermarkersettings.length - 1; y++) {
				totalDistance = parseFloat(route.extensions.weathermarkersettings[i].nextwaypointdistance) + parseFloat(route.extensions.weathermarkersettings[i + 1].nextwaypointdistance); //add up distances
				if (showhidedistance > totalDistance) {
					try { //remove the marker
                        mapSource.removeFeature(mapSource.getFeatureById("routeweathermarker_" + (i) + "_wavemarker"));
                        mapSource.removeFeature(mapSource.getFeatureById("routeweathermarker_" + (i) + "_currentmarker"));
                        mapSource.removeFeature(mapSource.getFeatureById("routeweathermarker_" + (i) + "_windmarker"));
                        mapSource.removeFeature(mapSource.getFeatureById("routemarkertext_" + (i)));
					} catch (ExceptionNoFeature) { }

                    route.extensions.weathermarkersettings[i].visible = false; //set status of this marker
					route.extensions.weathermarkersettings[i].zoomdisplay = mapZoomLevel; //save at which zoomlevel to show this marker again
				}else{
                    route.extensions.weathermarkersettings[i].visible = true; //set status of this marker
                }
			}
			//add markers and text that are within acceptable distance again on zoom change
			if (route.extensions.weathermarkersettings[i].zoomdisplay > 0 && mapZoomLevel > (route.extensions.weathermarkersettings[i].zoomdisplay)) {
                route.extensions.weathermarkersettings[i].visible = true; //set status of this marker
				updateRouteWORMFunction(i);
                updateRouteWORMTextFunction(i);
				route.extensions.weathermarkersettings[i].zoomdisplay = 0; //reset marker zoom behaviour
			}else{
            }
		}
	}
	var showhidedistance = 0; //zoom level controls allowed distance between markers - based on size of WORM by scale
	switch (mapZoomLevel) {

		case 11:
			showhidedistance = 0.9;
			break;
		case 10:
			showhidedistance = 1.8;
			break;
		case 9:
			showhidedistance = 3.5;
			break;
		case 8:
			showhidedistance = 6;
			break;
		case 7:
			showhidedistance = 11;
			break;
		case 6:
			showhidedistance = 22;
			break;
		case 5:
			showhidedistance = 33;
			break;
		case 4:
			showhidedistance = 66;
			break;
	}
	hideshowmarkerswithindistance(showhidedistance);
}

function removeAllWeatherMarkers(){ //removes all weathermarkers
    for (var y = 0; y !== route.waypoints.length; y++) {
		try {
			mapSource.removeFeature(mapSource.getFeatureById("routeweathermarker_" + (y) + "_wavemarker"));
			mapSource.removeFeature(mapSource.getFeatureById("routeweathermarker_" + (y) + "_currentmarker"));
			mapSource.removeFeature(mapSource.getFeatureById("routeweathermarker_" + (y) + "_windmarker"));
			mapSource.removeFeature(mapSource.getFeatureById("routemarkertext_" + (y)));
		} catch (ExceptionNoFeature) { }
	}
}

function rendertimeformat(tm) {
	if (tm && tm !== "") return tm.toISOString().substring(0, tm.toISOString().length - 4) + "00Z";
}

function retDayFromRTZ(tm) { //returns which day it is from a timestamp
	var days,
		tm = tm.split("T")[0],
		tmnew = new Date(tm);
	days = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
	return days[tmnew.getUTCDay()];
}


Number.prototype.validateBetween = function (a, b) {
    min = Math.min.apply(Math, [a, b]);
    max = Math.max.apply(Math, [a, b]);
    var minValid = this >= min;
    var maxValid = this <= max;
    return {"minValid": minValid, "maxValid": maxValid};
};

function validateNumber(inputString, min, max, decimals) { // maxnums is total allowed numbers, valtype is "int" ||"float" to test on, returned is always array [(true/false), (value as string)].
    var errorMsg = "",
        isValid = false, outputString = "", hasPeriod = false;
    if(inputString) {
        inputString = inputString.toString().trim(); // space only trim works because inputs have ng-trim="false" and triggers validate
        if (decimals > 0) {
            inputString = inputString.replace(/[^0-9.,]/g, '');
            inputString = inputString.replace(/[,]/g, '.');
        } else {
            inputString = inputString.replace(/[^0-9]/g, ''); //no decimals allowed
        }
        hasPeriod = inputString.indexOf(".") > -1;
        if (!decimals || decimals == "") decimals = 0;
        inputString = String(inputString); //force to string
        if (inputString == "." || inputString == "0.0") inputString = "0.";
        if (inputString.length < 1) errorMsg = "Missing number to validate on in function 'validateNumber'.";
        if (inputString.length > 0) {
            var inputFloat = parseFloat(inputString); //float it
            if (isNaN(inputFloat)) inputFloat = 0.0;
            var retvalidation = inputFloat.validateBetween(min, max, true);
            if (retvalidation.minValid && retvalidation.maxValid){
                isValid = true;
            // } else{
            //     inputFloat = max;
            }
            outputString = inputString; //swap!
            if (hasPeriod === true) {
                var tmpStr2 = "";
                var numStr = outputString.split('.');
                var tmpStr = numStr[0];
                try {
                    tmpStr2 = numStr[1].substring(0, decimals);
                } catch (noDecimals) {
                }
                outputString = tmpStr + "." + tmpStr2;
            }
        }
    }else{
        return {"valid": false, "val": 0};
    }
    return {"valid": isValid, "val": outputString}; //cant call it value because its a js constant
}



