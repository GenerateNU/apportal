package application

type CreateUploadURLInput struct {
	ID         string `path:"id" doc:"Application ID"`
	QuestionID string `path:"questionId"`
	Body       struct {
		Filename string `json:"filename"`
	}
}

type CreateUploadURLOutput struct {
	Body struct {
		Path      string `json:"path"`
		UploadURL string `json:"upload_url"`
	}
}

type CreateFileURLInput struct {
	ID         string `path:"id" doc:"Application ID"`
	QuestionID string `path:"questionId"`
}

type CreateFileURLOutput struct {
	Body struct {
		URL string `json:"url"`
	}
}
