package cycleworkflow

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
	"gorm.io/gorm"
)

var (
	readErrors  = []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity}
	writeErrors = []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusConflict, http.StatusUnprocessableEntity}
)

func Route(api huma.API, db *gorm.DB) {
	s := newService(db)
	tags := []string{"Workflow"}

	huma.Register(api, huma.Operation{
		OperationID: "list-cycle-steps",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/steps",
		Summary:     "List a cycle's steps and their settings",
		Description: "Staff on the cycle.",
		Tags:        tags,
		Errors:      readErrors,
	}, s.listSteps)

	huma.Register(api, huma.Operation{
		OperationID: "set-cycle-step",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/steps/{step}",
		Summary:     "Turn a step on or off",
		Description: "Chief only. Locked after the cycle's first advance.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.setStep)

	huma.Register(api, huma.Operation{
		OperationID: "set-step-assignment",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/steps/{step}/assignments/{kind}",
		Summary:     "Set how many of a kind each applicant gets in a step",
		Description: "Chief only. Locked once the step starts for any opening.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.setAssignment)

	huma.Register(api, huma.Operation{
		OperationID: "remove-step-assignment",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/steps/{step}/assignments/{kind}",
		Summary:     "Turn off a kind of assignment in a step",
		Description: "Chief only. Locked once the step starts for any opening.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.removeAssignment)

	huma.Register(api, huma.Operation{
		OperationID: "get-cycle-workflow",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/workflow",
		Summary:     "The caller's layer of a cycle's workflow",
		Description: "Staff on the cycle. Leads get the steps, deadlines and their own tasks; chiefs and admins also get late counts and next actions.",
		Tags:        tags,
		Errors:      readErrors,
	}, s.getWorkflow)

	huma.Register(api, huma.Operation{
		OperationID: "release-opening-step",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/openings/{role_id}/steps/{step}/release",
		Summary:     "Release a step for one opening",
		Description: "Chief only. Needs a future deadline for the step's main kind and the previous step closed. Idempotent.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.release)

	huma.Register(api, huma.Operation{
		OperationID: "unrelease-opening-step",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/openings/{role_id}/steps/{step}/release",
		Summary:     "Take back a step's release for one opening",
		Description: "Chief only. Once the next step starts it is an override that chiefs and admins confirm with confirm_override=true.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.unrelease)

	huma.Register(api, huma.Operation{
		OperationID: "set-opening-deadline",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/openings/{role_id}/steps/{step}/deadlines/{kind}",
		Summary:     "Set a deadline for one opening's step",
		Description: "Chief only. Once the next step starts it is an override that chiefs and admins confirm with confirm_override=true. Extending a passed deadline reopens the step.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.setDeadline)

	huma.Register(api, huma.Operation{
		OperationID: "clear-opening-deadline",
		Method:      http.MethodDelete,
		Path:        "/cycles/{id}/openings/{role_id}/steps/{step}/deadlines/{kind}",
		Summary:     "Remove a deadline from one opening's step",
		Description: "Chief only. Once the next step starts it is an override that chiefs and admins confirm with confirm_override=true.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.clearDeadline)

	huma.Register(api, huma.Operation{
		OperationID: "advance-cycle-step",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/steps/{step}/advance",
		Summary:     "Move applicants to the next enabled step",
		Description: "Chief only. 409 unless the step is closed for each affected opening (or, for reviews and interviews, released with all required work submitted), or if an applicant isn't in this step.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.advance)

	huma.Register(api, huma.Operation{
		OperationID: "undo-cycle-step-advance",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/steps/{step}/advance/undo",
		Summary:     "Undo the most recent advance out of a step",
		Description: "Chief only. One level, and only before the step moved into is released or worked on.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.undo)

	huma.Register(api, huma.Operation{
		OperationID: "complete-cycle-step",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/steps/{step}/complete",
		Summary:     "Mark a step complete",
		Description: "Chief only. Earlier steps must be complete and no applicants left in the step.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.complete)

	huma.Register(api, huma.Operation{
		OperationID: "close-cycle",
		Method:      http.MethodPost,
		Path:        "/cycles/{id}/close",
		Summary:     "Close a cycle",
		Description: "Chief only. Closing before every enabled step is complete is destructive and needs confirm_override=true.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.closeCycle)

	huma.Register(api, huma.Operation{
		OperationID: "list-review-gates",
		Method:      http.MethodGet,
		Path:        "/cycles/{id}/review-gates",
		Summary:     "Peer review release and progress per opening",
		Description: "Staff on the cycle. One entry per opening and review kind whose step the cycle runs.",
		Tags:        tags,
		Errors:      readErrors,
	}, s.listReviewGates)

	huma.Register(api, huma.Operation{
		OperationID: "set-review-release",
		Method:      http.MethodPut,
		Path:        "/cycles/{id}/review-gates",
		Summary:     "Show or hide reviewers' reviews from each other for an opening",
		Description: "Chief only. Hiding again, or changing it once the next step starts, is an override confirmed with confirm_override=true.",
		Tags:        tags,
		Errors:      writeErrors,
	}, s.setPeerRelease)
}
