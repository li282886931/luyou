#!/usr/bin/env python3
"""Exercise the D1 migrations against SQLite using the runtime signup contract."""

from __future__ import annotations

import json
import sqlite3
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent.parent
MIGRATIONS = ROOT / "drizzle"
STATEMENT_BREAKPOINT = "--> statement-breakpoint"

RUNTIME_COLUMNS = {
    "id",
    "created_at",
    "updated_at",
    "status",
    "name",
    "phone",
    "wechat",
    "role",
    "gender",
    "age",
    "zodiac",
    "work",
    "home",
    "pickup",
    "vehicle",
    "license_plate",
    "seats",
    "note",
    "smoking",
    "accepts_smoking",
    "room_type",
    "modifications_json",
    "modification_other",
    "deposit_status",
    "interests_json",
    "assigned_owner_id",
    "activity_id",
    "user_id",
    "contact_consent",
    "notification_consent",
    "signup_status",
}


def apply_migrations(connection: sqlite3.Connection) -> None:
    migration_files = sorted(MIGRATIONS.glob("[0-9][0-9][0-9][0-9]_*.sql"))
    if not migration_files:
        raise AssertionError("No D1 migrations found")

    for migration in migration_files:
        source = migration.read_text("utf-8")
        for statement in source.split(STATEMENT_BREAKPOINT):
            if statement.strip():
                connection.executescript(statement)


class MigrationContractTest(unittest.TestCase):
    def setUp(self) -> None:
        self.database = sqlite3.connect(":memory:")
        apply_migrations(self.database)

    def tearDown(self) -> None:
        self.database.close()

    def test_signup_schema_contains_every_runtime_column(self) -> None:
        columns = {
            row[1]
            for row in self.database.execute("PRAGMA table_info(signups)").fetchall()
        }
        self.assertEqual(set(), RUNTIME_COLUMNS - columns)

    def test_runtime_signup_insert_and_read_succeeds(self) -> None:
        values = {
            "id": "signup-1",
            "created_at": "2026-09-28T00:00:00Z",
            "updated_at": "2026-09-28T00:00:00Z",
            "name": "测试车主",
            "phone": "13900000001",
            "wechat": "test_owner",
            "role": "owner",
            "gender": "男",
            "age": "31-35",
            "zodiac": "双子座",
            "work": "海淀",
            "home": "朝阳",
            "pickup": "清河",
            "vehicle": "SUV",
            "license_plate": "京A12345",
            "seats": 2,
            "note": "无",
            "smoking": "不吸烟",
            "accepts_smoking": "不接受",
            "room_type": "标间",
            "modifications_json": json.dumps(["轮胎"], ensure_ascii=False),
            "modification_other": "",
            "deposit_status": "待核验",
            "interests_json": json.dumps(["摄影"], ensure_ascii=False),
        }
        self.database.execute(
            """
            INSERT INTO signups (
              id, created_at, updated_at, status, name, phone, wechat, role,
              gender, age, zodiac, work, home, pickup, vehicle, license_plate,
              seats, note, smoking, accepts_smoking, room_type,
              modifications_json, modification_other, deposit_status,
              interests_json
            )
            VALUES (
              :id, :created_at, :updated_at, '待匹配', :name, :phone, :wechat,
              :role, :gender, :age, :zodiac, :work, :home, :pickup, :vehicle,
              :license_plate, :seats, :note, :smoking, :accepts_smoking,
              :room_type, :modifications_json, :modification_other,
              :deposit_status, :interests_json
            )
            """,
            values,
        )
        row = self.database.execute(
            """
            SELECT wechat, license_plate, modifications_json, deposit_status,
                   assigned_owner_id
            FROM signups
            WHERE phone = ?
            """,
            ("13900000001",),
        ).fetchone()
        self.assertEqual(
            ("test_owner", "京A12345", '["轮胎"]', "待核验", None),
            row,
        )

    def test_signups_are_unique_per_activity(self) -> None:
        columns = [
            "id", "created_at", "updated_at", "name", "phone", "role",
            "work", "home", "activity_id"
        ]
        placeholders = ", ".join("?" for _ in columns)
        sql = f"INSERT INTO signups ({', '.join(columns)}) VALUES ({placeholders})"
        common = (
            "2026-09-28T00:00:00Z",
            "2026-09-28T00:00:00Z",
            "测试成员",
            "13900000008",
            "rider",
            "海淀",
            "朝阳",
        )
        self.database.execute(sql, ("signup-a", *common, "activity-a"))
        self.database.execute(sql, ("signup-b", *common, "activity-b"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.database.execute(sql, ("signup-c", *common, "activity-a"))

    def test_activity_and_audit_tables_exist(self) -> None:
        tables = {
            row[0]
            for row in self.database.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        self.assertTrue({"activities", "audit_logs"}.issubset(tables))

    def test_matching_notification_and_capability_tables_exist(self) -> None:
        tables = {
            row[0]
            for row in self.database.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        self.assertTrue(
            {
                "match_runs",
                "match_assignments",
                "notifications",
                "participant_capabilities",
            }.issubset(tables)
        )

        assignment_columns = {
            row[1]
            for row in self.database.execute(
                "PRAGMA table_info(match_assignments)"
            ).fetchall()
        }
        self.assertTrue(
            {
                "match_run_id",
                "activity_id",
                "owner_signup_id",
                "rider_signup_id",
                "score",
                "reasons_json",
                "source",
                "locked",
                "created_at",
                "updated_at",
            }.issubset(assignment_columns)
        )

        self.database.execute(
            """
            INSERT INTO match_runs (
              id, activity_id, status, algorithm_version, created_by, created_at
            ) VALUES (?, ?, 'draft', 'rules-v1', 'admin', ?)
            """,
            ("run-1", "activity-a", "2026-09-28T00:00:00Z"),
        )
        assignment = (
            "assignment-1",
            "run-1",
            "activity-a",
            "owner-1",
            "rider-1",
            88,
            '["住所路线接近"]',
            "automatic",
            0,
            "2026-09-28T00:00:00Z",
            "2026-09-28T00:00:00Z",
        )
        self.database.execute(
            """
            INSERT INTO match_assignments (
              id, match_run_id, activity_id, owner_signup_id, rider_signup_id,
              score, reasons_json, source, locked, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            assignment,
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.database.execute(
                """
                INSERT INTO match_assignments (
                  id, match_run_id, activity_id, owner_signup_id,
                  rider_signup_id, score, reasons_json, source, locked,
                  created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ("assignment-2", *assignment[1:]),
            )

    def test_publishing_tables_preserve_versions_and_media_order(self) -> None:
        tables = {
            row[0]
            for row in self.database.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        self.assertTrue({"posts", "media_assets", "post_media"}.issubset(tables))
        post = (
            "post-1",
            "activity-a",
            "recruitment",
            "第一版",
            '{"title":"第一版"}',
            "published",
            1,
            "2026-09-28T00:00:00Z",
            "2026-09-28T00:00:00Z",
            "2026-09-28T00:00:00Z",
        )
        self.database.execute(
            """
            INSERT INTO posts (
              id, activity_id, type, title, content_json, status, version,
              created_at, updated_at, published_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            post,
        )
        with self.assertRaises(sqlite3.IntegrityError):
            self.database.execute(
                """
                INSERT INTO posts (
                  id, activity_id, type, title, content_json, status, version,
                  created_at, updated_at, published_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                ("post-duplicate", *post[1:]),
            )
        self.database.execute(
            """
            INSERT INTO media_assets (
              id, activity_id, storage_path, name, mime_type, size, status,
              created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                "media-1",
                "activity-a",
                "club-media/photo.jpg",
                "photo.jpg",
                "image/jpeg",
                1024,
                "uploaded",
                "2026-09-28T00:00:00Z",
            ),
        )
        self.database.execute(
            """
            INSERT INTO post_media (
              post_id, media_asset_id, role, sort_order
            ) VALUES (?, ?, ?, ?)
            """,
            ("post-1", "media-1", "cover", 0),
        )

    def test_wechat_identity_session_and_subscription_tables_exist(self) -> None:
        tables = {
            row[0]
            for row in self.database.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        self.assertTrue(
            {
                "users",
                "wechat_identities",
                "user_sessions",
                "subscription_grants",
            }.issubset(tables)
        )
        identity_columns = {
            row[1]
            for row in self.database.execute(
                "PRAGMA table_info(wechat_identities)"
            ).fetchall()
        }
        self.assertTrue(
            {
                "id",
                "user_id",
                "openid",
                "unionid",
                "created_at",
                "updated_at",
            }.issubset(identity_columns)
        )
        session_columns = {
            row[1]
            for row in self.database.execute(
                "PRAGMA table_info(user_sessions)"
            ).fetchall()
        }
        self.assertTrue(
            {
                "id",
                "user_id",
                "token_hash",
                "expires_at",
                "created_at",
            }.issubset(session_columns)
        )

    def test_operations_locations_and_content_generation_tables_exist(self) -> None:
        tables = {
            row[0]
            for row in self.database.execute(
                "SELECT name FROM sqlite_master WHERE type = 'table'"
            ).fetchall()
        }
        self.assertTrue(
            {
                "signup_locations",
                "signup_operations",
                "content_generations",
            }.issubset(tables)
        )
        media_columns = {
            row[1]
            for row in self.database.execute(
                "PRAGMA table_info(media_assets)"
            ).fetchall()
        }
        self.assertTrue(
            {
                "focus_x",
                "focus_y",
                "cover_score",
                "crop_suggestions_json",
            }.issubset(media_columns)
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
