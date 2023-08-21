# hra-ref-organ-validation

Code to validate part-of relationships implicit in 3D reference organs with relationships in Uberon

## Installation

After checking out the code, run `npm ci` to install dependencies. This code requires Node 18+.

## Running validations

1. Run `npm run build` to generate the jsonld data for querying
2. Run `npm run validate` to validate the data gathered with Uberon via Ubergraph

## Results

Results are available in the [data directory](./data)
