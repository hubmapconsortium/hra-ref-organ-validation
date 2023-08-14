import { writeFileSync } from 'fs';
import Papa from 'papaparse';

const OUTPUT = 'data/ref-organ-collisions.jsonld';
const REGISTRATIONS = 'data/ref-organ-registrations.jsonld';
const RELATIONS = 'data/ref-organ-relations.csv';

const REF_ORGAN_SOURCE =
  'https://raw.githubusercontent.com/hubmapconsortium/hubmap-ontology/master/source_data/generated-reference-spatial-entities.jsonld';
const API = 'https://pfn8zf2gtu.us-east-2.awsapprunner.com/get-collisions';
const PREFIX = 'http://purl.org/ccf/latest/ccf.owl';

function getCollisions(ruiLocation) {
  return fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ruiLocation),
  })
    .then((r) => r.json())
    .catch((e) => (console.log(e), []));
}

function addPrefix(obj) {
  obj['@id'] = PREFIX + obj['@id'];
}

function fixRuiLocation(rui_location) {
  if (Array.isArray(rui_location.placement) && rui_location.placement.length > 0) {
    rui_location.placement = rui_location.placement[0];
  }
  delete rui_location.object;
  delete rui_location.rui_rank;
  addPrefix(rui_location.placement);
  addPrefix(rui_location);
  rui_location.reference_organ = PREFIX + rui_location.reference_organ;
  return rui_location;
}

function fixPlacement(rui_location, refOrganLookup) {
  const refOrganIri = rui_location.reference_organ;
  const refOrgan = refOrganLookup[refOrganIri];
  const [sx, sy, sz] = [
    rui_location.placement.x_translation,
    rui_location.placement.y_translation,
    rui_location.placement.z_translation,
  ];
  const [tx, ty, tz] = [
    refOrgan.placement.x_translation,
    refOrgan.placement.y_translation,
    refOrgan.placement.z_translation,
  ];
  rui_location.placement.x_translation = Math.abs(sx - tx);
  rui_location.placement.y_translation = Math.abs(sy - ty);
  rui_location.placement.z_translation = Math.abs(tz - sz);
  rui_location.placement.target = refOrganIri;

  delete rui_location.reference_organ;
  delete rui_location.sex;
}

const refOrganEntities = (await fetch(REF_ORGAN_SOURCE).then((r) => r.json()))
  .filter((s) => s['@type'] === 'SpatialEntity' && s.reference_organ)
  .map(fixRuiLocation);

const refOrganLookup = refOrganEntities.reduce(
  (acc, entity) => ((acc[entity['@id']] = JSON.parse(JSON.stringify(entity))), acc),
  {}
);

refOrganEntities.forEach((s) => fixPlacement(s, refOrganLookup));

// Write out derived registrations
writeFileSync(REGISTRATIONS, JSON.stringify(refOrganEntities, null, 2));

// Find all datasets in rui_locations.jsonld and add run collision detection on them
const results = [];
let bad = 0;
let one = 0;
let other = 0;

for (const rui_location of refOrganEntities) {
  const collisions = (await getCollisions(rui_location)).filter(
    (c) => c.percentage_of_tissue_block > 0 && c.representation_of !== '-'
  );
  results.push({
    '@type': 'CollisionSummary',
    collision_source: rui_location['@id'],
    collision_method: 'MESH',
    collisions: collisions.map((c) => ({
      '@type': 'CollisionItem',
      reference_organ: rui_location.placement.target,
      as_3d_id: c.id,
      as_id: c.representation_of,
      as_label: c.label,
      as_volume: c.AS_volume,
      percentage: c.percentage_of_tissue_block,
    })),
  });

  if (collisions.length === 0) {
    bad++;
  } else if (collisions.length === 1) {
    one++;
  }
  if (collisions.length > 1) {
    other++;
  }
}

if (other > 0) {
  console.log(`${other} RUI locations had more than one collision`);
}
if (one > 0) {
  console.log(`${one} RUI locations had one collision`);
}
if (bad > 0) {
  console.log(`WARNING ${bad} RUI locations had zero collisions`);
}

// Write out the new collisions.jsonld file
const jsonld = {
  '@context': 'https://hubmapconsortium.github.io/ccf-ontology/ccf-context.jsonld',
  '@graph': results,
};
writeFileSync(OUTPUT, JSON.stringify(jsonld, null, 2));

const relations = [];
for (const result of results) {
  const parent = refOrganLookup[result.collision_source].representation_of.replace('UBERON:', 'http://purl.obolibrary.org/obo/UBERON_');
  for (const collision of result.collisions) {
    const child = collision.as_id.replace('UBERON:', 'http://purl.obolibrary.org/obo/UBERON_');
    relations.push({ s: parent, o: child });
  }
}

writeFileSync(RELATIONS, Papa.unparse(relations, { header: true }))
