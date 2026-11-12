variable "atlas_public_key" {
  type = string
}

variable "atlas_private_key" {
  type      = string
  sensitive = true
}

variable "atlas_org_id" {
  type        = string
  description = "ID de la organización de MongoDB Atlas."
}

variable "atlas_region" {
  type        = string
  default     = "US_EAST_1"
  description = "Región de Atlas; US_EAST_1 coincide con Render virginia (el Blueprint usa esa región)."
}

variable "db_name" {
  type        = string
  default     = "fidelhop"
  description = "Debe coincidir con DB_NAME del render.yaml."
}
