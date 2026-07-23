import assert from "node:assert/strict";
import test from "node:test";
import { __nasrActivityAreaTestUtils } from "../../server/services/nasrActivityAreas";

const { buildMaaFeatures, buildPjaFeatures, parseCsv, parseDmsCoordinate } = __nasrActivityAreaTestUtils;

test("NASR CSV parser handles quoted fields and doubled quotes", () => {
  const rows = parseCsv('"ID","NAME","REMARK"\n"1","Ann Arbor","Pilot said ""verify NOTAMs"""\n');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].ID, "1");
  assert.equal(rows[0].NAME, "Ann Arbor");
  assert.equal(rows[0].REMARK, 'Pilot said "verify NOTAMs"');
});

test("NASR DMS coordinates convert to signed decimal degrees", () => {
  assert.equal(Number(parseDmsCoordinate("33-54-00.0000N")?.toFixed(4)), 33.9);
  assert.equal(Number(parseDmsCoordinate("087-18-00.0000W")?.toFixed(4)), -87.3);
});

test("PJA base rows become route-map features with centers and radius polygons", () => {
  const csv = [
    '"EFF_DATE","PJA_ID","NAV_ID","NAV_TYPE","RADIAL","DISTANCE","NAVAID_NAME","STATE_CODE","CITY","LATITUDE","LAT_DECIMAL","LONGITUDE","LONG_DECIMAL","ARPT_ID","SITE_NO","SITE_TYPE_CODE","DROP_ZONE_NAME","MAX_ALTITUDE","MAX_ALTITUDE_TYPE_CODE","PJA_RADIUS","CHART_REQUEST_FLAG","PUBLISH_CRITERIA","DESCRIPTION","TIME_OF_USE","FSS_ID","FSS_NAME","PJA_USE","VOLUME","PJA_USER","REMARK"',
    '"2026-08-06","123","ARB","VOR","000","0","ANN ARBOR","MI","ANN ARBOR","42-13-24.0000N","42.223333","083-44-42.0000W","-83.745000","KARB","","","ANN ARBOR DROP ZONE","14500","MSL","2.5","Y","","","SR-SS","LAN","LANSING","Y","","","Call before jump ops"',
  ].join("\n");
  const features = buildPjaFeatures(csv, "August 6, 2026");
  assert.equal(features.length, 1);
  assert.equal(features[0].properties.activityType, "PJA");
  assert.equal(features[0].properties.typeLabel, "Parachute Jump Area");
  assert.equal(features[0].properties.displayCenterLat, 42.223333);
  assert.equal(features[0].properties.displayCenterLon, -83.745);
  assert.equal(features[0].geometry.type, "Polygon");
});

test("MAA shape rows become polygon advisory features", () => {
  const baseCsv = [
    '"EFF_DATE","MAA_ID","MAA_TYPE_NAME","NAV_ID","NAV_TYPE","NAV_RADIAL","NAV_DISTANCE","STATE_CODE","CITY","LATITUDE","LONGITUDE","ARPT_IDS","NEAREST_ARPT","NEAREST_ARPT_DIST","NEAREST_ARPT_DIR","MAA_NAME","MAX_ALT","MIN_ALT","MAA_RADIUS","DESCRIPTION","MAA_USE","CHECK_NOTAMS","TIME_OF_USE","USER_GROUP_NAME"',
    '"2026-08-06","A1","AEROBATIC AREA","","","","","MI","TEST","","","","","","","TEST ACRO","5000","SFC","","Practice area","Y","Y","DAYLIGHT","CLUB"',
  ].join("\n");
  const shapeCsv = [
    '"EFF_DATE","MAA_ID","POINT_SEQ","LATITUDE","LONGITUDE"',
    '"2026-08-06","A1","1","42-00-00.0000N","083-00-00.0000W"',
    '"2026-08-06","A1","2","42-10-00.0000N","083-00-00.0000W"',
    '"2026-08-06","A1","3","42-10-00.0000N","083-10-00.0000W"',
  ].join("\n");
  const features = buildMaaFeatures(baseCsv, shapeCsv, "August 6, 2026");
  assert.equal(features.length, 1);
  assert.equal(features[0].properties.activityType, "MAA");
  assert.equal(features[0].properties.typeLabel, "AEROBATIC AREA");
  assert.equal(features[0].geometry.type, "Polygon");
});
