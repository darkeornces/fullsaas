resource "random_password" "db" {
  length  = 32
  special = false
}

resource "mongodbatlas_project" "fidelhop" {
  name   = "fidelhop"
  org_id = var.atlas_org_id
}

resource "mongodbatlas_advanced_cluster" "fidelhop" {
  project_id   = mongodbatlas_project.fidelhop.id
  name         = "fidelhop"
  cluster_type = "REPLICASET"

  replication_specs = [
    {
      region_configs = [
        {
          electable_specs = {
            instance_size = "M0"
          }
          provider_name         = "TENANT"
          backing_provider_name = "AWS"
          region_name           = var.atlas_region
          priority              = 7
        }
      ]
    }
  ]
}

resource "mongodbatlas_database_user" "app" {
  project_id         = mongodbatlas_project.fidelhop.id
  username           = "fidelhop"
  password           = random_password.db.result
  auth_database_name = "admin"

  roles {
    role_name     = "readWrite"
    database_name = var.db_name
  }
}

# Render (plan gratis) no tiene IPs de salida fijas: se abre a todo internet y la
# protección es la contraseña aleatoria de 32 caracteres del usuario de la base.
resource "mongodbatlas_project_ip_access_list" "render" {
  project_id = mongodbatlas_project.fidelhop.id
  cidr_block = "0.0.0.0/0"
  comment    = "Render (salida dinámica)"
}
