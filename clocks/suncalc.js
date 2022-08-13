/*
 (c) 2011-2015, Vladimir Agafonkin
 SunCalc is a JavaScript library for calculating sun/moon position and light phases.
 https://github.com/mourner/suncalc
*/

(function () {
    'use strict';

    // sun calculations are based on http://aa.quae.nl/en/reken/zonpositie.html formulas
    const SkyCalc = {
        getMoonPosition: (date, lat, lng) => {
            var d = date.valueOf() / 86400000 - 10957.5,
                l = (218.316 + 13.176396 * d + 6.289 * Math.sin((134.963 + 13.064993 * d) * Math.PI / 180)) * Math.PI / 180, // longitude
                b = 5.128 * Math.sin((93.272 + 13.229350 * d) * Math.PI / 180) * Math.PI / 180, // latitude
                dec = Math.asin(Math.sin(b) * Math.cos(0.4091) + Math.cos(b) * Math.sin(0.4091) * Math.sin(l)),
                H = (280.16 + 360.9856235 * d + lng) * Math.PI / 180 - Math.atan2(Math.sin(l) * Math.cos(0.4091) - Math.tan(b) * Math.sin(0.4091), Math.cos(l)),
                h = Math.asin(Math.sin(lat * Math.PI / 180) * Math.sin(dec) + Math.cos(lat * Math.PI / 180) * Math.cos(dec) * Math.cos(H));

            return {
                azimuth: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat * Math.PI / 180) - Math.tan(dec) * Math.cos(lat * Math.PI / 180)),
                // formula 16.4 of "Astronomical Algorithms" 2nd edition by Jean Meeus (Willmann-Bell, Richmond) 1998.
                // 1.02 / tan(h + 10.26 / (h + 5.10)) h in degrees, result in arc minutes -> converted to rad:
                altitude: h + (h > 0
                    ? 0.0002967 / Math.tan(h + 0.00312536 / (h + 0.08901179))
                    : 0.008446689) // altitude correction for refraction
            };
        },

        // calculations for moon rise/set times are based on http://www.stargazing.net/kepler/moonrise.html article
        getMoonTimes: (date, lat, lng, inUTC) => {
            var dt = new Date(date);
            if (inUTC) dt.setUTCHours(0, 0, 0, 0);
            else dt.setHours(0, 0, 0, 0);

            var h0 = SkyCalc.getMoonPosition(dt, lat, lng).altitude - 0.133 * Math.PI / 180,
                h1, h2, rise, set, a, b, xe, ye, d, roots, x1, x2, dx,
                t = dt.valueOf();

            // go in 2-hour chunks, each time seeing if a 3-point quadratic curve crosses zero (which means rise or set)
            for (var i = 1; i <= 24; i += 2) {
                h1 = SkyCalc.getMoonPosition(new Date(t + i * 3600000), lat, lng).altitude - 0.133 * Math.PI / 180;
                h2 = SkyCalc.getMoonPosition(new Date(t + (i + 1) * 3600000), lat, lng).altitude - 0.133 * Math.PI / 180;

                a = (h0 + h2) / 2 - h1;
                b = (h2 - h0) / 2;
                xe = -b / (2 * a);
                ye = (a * xe + b) * xe + h1;
                d = b * b - 4 * a * h1;
                roots = 0;

                if (d >= 0) {
                    dx = Math.sqrt(d) / (Math.abs(a) * 2);
                    x1 = xe - dx;
                    x2 = xe + dx;
                    if (Math.abs(x1) <= 1) roots++;
                    if (Math.abs(x2) <= 1) roots++;
                    if (x1 < -1) x1 = x2;
                }

                if (roots === 1) {
                    if (h0 < 0) rise = i + x1;
                    else set = i + x1;

                } else if (roots === 2) {
                    rise = i + (ye < 0 ? x2 : x1);
                    set = i + (ye < 0 ? x1 : x2);
                }

                if (rise && set) break;

                h0 = h2;
            }

            var result = {};

            if (rise) result.rise = new Date(t + rise * 3600000);
            if (set) result.set = new Date(t + set * 3600000);

            if (!rise && !set) result[ye > 0 ? 'alwaysUp' : 'alwaysDown'] = true;

            return result;
        },

        // calculates sun times for a given date, latitude/longitude
        getSunTimes: (date, lat, lng) => {
            var n = Math.round(date.valueOf() / 86400000 - 10957.5009 + lng / 360),
                ds = 0.0009 - lng / 360 + n,
                M = (357.5291 + 0.98560028 * ds) * Math.PI / 180,
                L = M + (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M) + 282.9372) * Math.PI / 180,
                dec = Math.asin(Math.sin(0.4091) * Math.sin(L)),
                Jnoon = 2451545 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);

            var result = {
                solarNoon: new Date((Jnoon + 0.5 - 2440588) * 86400000),
                nadir: new Date((Jnoon - 2440588) * 86400000)
            };

            for (let time of [
                [-0.833, 'sunrise', 'sunset'],
                [-0.3, 'sunriseEnd', 'sunsetStart'],
                [-6, 'dawn', 'dusk'],
                [6, 'goldenHourEnd', 'goldenHour']
            ]) {
                var Jset = 2451545 + 0.0009 + Math.acos(
                    (Math.sin((time[0]) * Math.PI / 180)
                        - Math.sin(lat * Math.PI / 180) * Math.sin(dec))
                    / (Math.cos(lat * Math.PI / 180) * Math.cos(dec))
                ) / (2 * Math.PI) - lng / 360 + n + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L)

                result[time[1]] = new Date((Jnoon * 2 - Jset + 0.5 - 2440588) * 86400000);
                result[time[2]] = new Date((Jset + 0.5 - 2440588) * 86400000);
            }

            return result;
        }
    };

    // export as Node module / AMD module / browser variable
    if (typeof exports === 'object' && typeof module !== 'undefined') module.exports = SkyCalc;
    else if (typeof define === 'function' && define.amd) define(SkyCalc);
    else window.SkyCalc = SkyCalc;

}());
