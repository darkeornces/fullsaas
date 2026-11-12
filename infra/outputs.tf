output "mongo_url" {
  description = "Pégala cuando Render pida MONGO_URL. Ver con: terraform output -raw mongo_url"
  sensitive   = true
  value = replace(
    mongodbatlas_advanced_cluster.fidelhop.connection_strings.standard_srv,
    "mongodb+srv://",
    "mongodb+srv://${mongodbatlas_database_user.app.username}:${random_password.db.result}@",
  )
}
