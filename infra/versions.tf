terraform {
  required_version = ">= 1.5"

  required_providers {
    mongodbatlas = {
      source  = "mongodb/mongodbatlas"
      version = ">= 2.0"
    }
    random = {
      source  = "hashicorp/random"
      version = ">= 3.5"
    }
  }
}

provider "mongodbatlas" {
  public_key  = var.atlas_public_key
  private_key = var.atlas_private_key
}
