import tempfile
import unittest
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app.taxonomy import parse_ebird_taxonomy_csv, species_display  # noqa: E402


class TestTaxonomy(unittest.TestCase):
    def test_parse_csv_maps_code_to_common(self):
        with tempfile.NamedTemporaryFile(
            "w", suffix=".csv", delete=False, encoding="utf-8", newline=""
        ) as f:
            f.write("SPECIES_CODE,COMMON_NAME,SCIENTIFIC_NAME,CATEGORY\n")
            f.write("blujay,Blue Jay,Cyanocitta cristata,species\n")
            f.write("norcar,Northern Cardinal,Cardinalis cardinalis,species\n")
            path = f.name
        try:
            m = parse_ebird_taxonomy_csv(path)
            self.assertEqual(m["BLUJAY"], "Blue Jay (Cyanocitta cristata)")
        finally:
            try:
                Path(path).unlink()
            except OSError:
                pass

    def test_species_display_uses_taxonomy(self):
        tax = {"NORCAR": "Northern Cardinal (Cardinalis cardinalis)"}
        disp, code = species_display("norcar", tax)
        self.assertEqual(disp, "Northern Cardinal (Cardinalis cardinalis)")
        self.assertEqual(code, "norcar")

    def test_species_display_heuristic_underscore(self):
        disp, code = species_display("blue_jay", {})
        self.assertEqual(disp, "Blue Jay")
        self.assertEqual(code, "blue_jay")


if __name__ == "__main__":
    unittest.main()
