# Zabun API Notes

- Wiki: https://gateway-cmsapi.v2.zabun.be/wiki

## Endpoints

### `GET /api/v1/person`

Returns metadata for all people/agents.

Example response excerpt:

```json
[
  {
    "status_id": 1,
    "active": true,
    "alias": "",
    "home_email": "",
    "direct_phone": "",
    "direct_phone_cc": "32",
    "mobile_phone": "475656675",
    "mobile_phone_cc": "32",
    "home_phone": "",
    "home_phone_cc": "32",
    "description": "3482",
    "reports_to_person_id": 25606,
    "creation_person_id": -15949,
    "changed_person_id": -18,
    "title_id": 4,
    "profile_id": 1,
    "person_id": 25606,
    "last_name": "Huyghe",
    "first_name": "Peter",
    "full_name": "Huyghe Peter",
    "email": "peter@metropoolvastgoed.be",
    "language": "NL",
    "creation": "2024-12-10T11:00:31+01:00",
    "changed": "2025-10-17T13:44:07+02:00",
    "company_id": 4357,
    "contact_autoid": "3775004357000000001"
  }
]
```

_Notes_: include mapping for Airtable `Zabun_Agents` once defined.
