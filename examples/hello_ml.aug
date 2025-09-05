// hello_ml.aug - Example Augustium contract with ML capabilities
use stdlib::ml::{NeuralNetwork, MLDataset, ModelMetrics};

contract HelloML {
    let mut model: NeuralNetwork;
    let mut training_data: MLDataset;
    let mut message: String;

    fn constructor(initial_message: String) {
        self.message = initial_message;
        self.model = NeuralNetwork::new(vec![10, 5, 1]);
        self.training_data = MLDataset::new();
    }

    pub fn get_message() -> String {
        self.message.clone()
    }

    pub fn set_message(new_message: String) {
        self.message = new_message;
    }

    pub fn add_training_data(features: Vec<f64>, label: f64) {
        self.training_data.add_sample(features, label);
    }

    pub fn train_model() -> ModelMetrics {
        self.model.train(&self.training_data, 100, 0.01)
    }

    pub fn predict(features: Vec<f64>) -> f64 {
        self.model.predict(&features)
    }

    pub fn get_model_accuracy() -> f64 {
        let metrics = self.model.evaluate(&self.training_data);
        metrics.accuracy
    }
}
