package util

var OnGrpcError func(err error) = func(err error) {}

func GrpcError(err error) error {
	if err != nil {
		OnGrpcError(err)
	}
	return err
}
