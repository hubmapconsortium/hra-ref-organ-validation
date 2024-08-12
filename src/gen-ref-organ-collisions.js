import { writeFileSync } from 'fs';
import Papa from 'papaparse';

const AS_3D_CSV = 'https://grlc.io/api-git/hubmapconsortium/ccf-grlc/subdir/mesh-collision/anatomical-structures.csv';
const RELATIONS = 'data/ref-organ-relations.csv';

const asData = await fetch(AS_3D_CSV).then((r) => r.text());
const asRows = Papa.parse(asData, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;
const glb2rows = asRows.reduce((acc, row) => {
  const glbUrl = row.glb_file;
  acc[glbUrl] = acc[glbUrl] || [];
  acc[glbUrl].push(row);
  return acc;
}, {});

const results = [];
for (const [glbUrl, rows] of Object.entries(glb2rows)) {
  if (rows.length > 1) {
    const refOrgan = rows[0].reference_organ;
    const termLookup = Object.fromEntries(rows.map((row) => [row.node_name, row.ontologyID]));

    console.log(new Date().toISOString(), 'requesting', glbUrl);
    sh.rm('-f', '.temp_model.glb', '.temp_collisions.csv');
    sh.exec(`curl -s "${glbUrl}" -o .temp_model.glb`);
    sh.exec(`python ../hra-glb-mesh-collisions/mesh-mesh-collisions.py .temp_model.glb .temp_collisions.csv`, {
      silent: false,
    });

    const csvText = readFileSync('.temp_collisions.csv').toString();
    const csvRows = Papa.parse(csvText, { header: true, dynamicTyping: true, skipEmptyLines: true }).data;

    for (const collision of csvRows) {
      const sourceTerm = termLookup[collision.source];
      const targetTerm = termLookup[collision.target];
      if (sourceTerm && targetTerm && sourceTerm !== targetTerm) {
        results.push({
          ref_organ: refOrgan,
          ref_organ_part: refOrgan.replace('#primary', `#${collision.source}`),
          parent: sourceTerm,
          child: targetTerm,
        });
        results.push({
          ref_organ: refOrgan,
          ref_organ_part: refOrgan.replace('#primary', `#${collision.target}`),
          parent: targetTerm,
          child: sourceTerm,
        });
      }
    }
  }
}

sh.rm('-f', '.temp_model.glb', '.temp_collisions.csv');

const outString = Papa.unparse(results, { header: true });
writeFileSync(RELATIONS, outString);

console.log(new Date().toISOString(), 'finished');
