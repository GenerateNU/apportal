package application

import (
	"net/http"

	"github.com/danielgtaylor/huma/v2"
)

func registerUpload(api huma.API, s *uploadService) {
	huma.Register(api, huma.Operation{
		OperationID: "create-answer-upload-url",
		Method:      http.MethodPost,
		Path:        "/applications/{id}/answers/{questionId}/upload-url",
		Summary:     "Get a signed URL to upload a PDF answer",
		Description: "Only valid for `url`-type questions. The caller PUTs the file to the returned URL, then records answer_file_path/answer_file_name via the answers upsert endpoint.",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound, http.StatusUnprocessableEntity},
	}, s.createUploadURL)

	huma.Register(api, huma.Operation{
		OperationID: "create-answer-file-url",
		Method:      http.MethodGet,
		Path:        "/applications/{id}/answers/{questionId}/file-url",
		Summary:     "Get a signed URL to view an uploaded PDF answer",
		Tags:        []string{"Answers"},
		Errors:      []int{http.StatusUnauthorized, http.StatusForbidden, http.StatusNotFound},
	}, s.createFileURL)
}
