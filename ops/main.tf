terraform {
  required_version = ">= 1.5.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 7.28"
    }
  }
}
provider "google" { project = var.project_id }
variable "project_id" { type = string }
variable "billing_account" { type = string }
variable "notification_email" { type = string }
variable "backup_location" { type = string }
variable "monthly_budget_usd" {
  type = number
  validation {
    condition     = var.monthly_budget_usd > 0 && floor(var.monthly_budget_usd) == var.monthly_budget_usd
    error_message = "Set a positive whole-dollar monthly budget."
  }
}
data "google_project" "chat" { project_id = var.project_id }
resource "google_monitoring_notification_channel" "email" {
  display_name = "Chat operations"
  type         = "email"
  labels       = { email_address = var.notification_email }
}
resource "google_logging_metric" "errors" {
  name   = "chat_operation_errors"
  filter = "resource.type=\"cloud_function\" AND (jsonPayload.event=\"chat.operation\" OR jsonPayload.event=\"chat.retention\") AND jsonPayload.outcome=\"error\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}
resource "google_logging_metric" "rejections" {
  name   = "chat_quota_rejections"
  filter = "resource.type=\"cloud_function\" AND jsonPayload.event=\"chat.operation\" AND jsonPayload.code=\"resource-exhausted\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}
resource "google_logging_metric" "latency" {
  name            = "chat_operation_duration_ms"
  filter          = "resource.type=\"cloud_function\" AND jsonPayload.event=\"chat.operation\" AND jsonPayload.outcome=\"ok\""
  value_extractor = "EXTRACT(jsonPayload.durationMs)"
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "DISTRIBUTION"
    unit        = "ms"
  }
  bucket_options {
    exponential_buckets {
      num_finite_buckets = 30
      growth_factor      = 1.5
      scale              = 1
    }
  }
}
resource "google_logging_metric" "retention" {
  name   = "chat_retention_success"
  filter = "resource.type=\"cloud_function\" AND jsonPayload.event=\"chat.retention\" AND jsonPayload.outcome=\"ok\""
  metric_descriptor {
    metric_kind = "DELTA"
    value_type  = "INT64"
    unit        = "1"
  }
}
resource "google_monitoring_alert_policy" "errors" {
  display_name          = "Chat: unexpected backend errors"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.name]
  conditions {
    display_name = "Unexpected errors in five minutes"
    condition_threshold {
      filter          = "resource.type=\"cloud_function\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.errors.name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "0s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_SUM"
      }
    }
  }
}
resource "google_monitoring_alert_policy" "latency" {
  display_name          = "Chat: p95 backend duration above two seconds"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.name]
  conditions {
    display_name = "p95 duration above 2000ms for five minutes"
    condition_threshold {
      filter          = "resource.type=\"cloud_function\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.latency.name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 2000
      duration        = "300s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }
}
resource "google_monitoring_alert_policy" "rejections" {
  display_name          = "Chat: sustained quota/admission pressure"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.name]
  conditions {
    display_name = "More than 30 rejections per minute for five minutes"
    condition_threshold {
      filter          = "resource.type=\"cloud_function\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.rejections.name}\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0.5
      duration        = "300s"
      aggregations {
        alignment_period   = "300s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }
}
resource "google_monitoring_alert_policy" "retention" {
  display_name          = "Chat: retention has stopped"
  combiner              = "OR"
  notification_channels = [google_monitoring_notification_channel.email.name]
  conditions {
    display_name = "No successful retention run for 30 minutes"
    condition_absent {
      filter   = "resource.type=\"cloud_function\" AND metric.type=\"logging.googleapis.com/user/${google_logging_metric.retention.name}\""
      duration = "1800s"
    }
  }
}
resource "google_billing_budget" "chat" {
  billing_account = var.billing_account
  display_name    = "Chat monthly project budget"
  budget_filter { projects = ["projects/${data.google_project.chat.number}"] }
  amount {
    specified_amount {
      currency_code = "USD"
      units         = tostring(var.monthly_budget_usd)
    }
  }
  dynamic "threshold_rules" {
    for_each = [0.5, 0.9, 1.0]
    content { threshold_percent = threshold_rules.value }
  }
  all_updates_rule {
    monitoring_notification_channels = [google_monitoring_notification_channel.email.name]
    disable_default_iam_recipients   = false
  }
}
resource "google_storage_bucket" "backup" {
  name                        = "${var.project_id}-chat-backups"
  location                    = var.backup_location
  uniform_bucket_level_access = true
  public_access_prevention    = "enforced"
  force_destroy               = false
  versioning { enabled = true }
  lifecycle_rule {
    condition { age = 30 }
    action { type = "Delete" }
  }
}
output "backup_bucket" { value = google_storage_bucket.backup.name }
