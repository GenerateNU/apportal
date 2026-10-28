data "external_schema" "gorm" {
  program = ["go", "run", "./cmd/schema"]
}

env "apportal" {
  src     = data.external_schema.gorm.url
  dev     = "docker://postgres/15/dev"
  # A direct/session connection, not Supabase's transaction pooler — Atlas
  # holds an advisory lock and runs DDL across one session.
  url     = getenv("MIGRATION_DB_CONNECTION_STRING")
  schemas = ["public"]
  migration {
    dir = "file://internal/migrations"
  }
  format {
    migrate {
      diff = "{{ sql . \"  \" }}"
    }
  }
}
