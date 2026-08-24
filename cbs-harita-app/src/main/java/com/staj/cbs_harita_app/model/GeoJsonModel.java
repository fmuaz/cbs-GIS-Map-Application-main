package com.staj.cbs_harita_app.model;

import java.util.List;
import java.util.Map;

public class GeoJsonModel {
    private String type = "FeatureCollection";
    private List<Feature> features;

    public GeoJsonModel() {}

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public List<Feature> getFeatures() { return features; }
    public void setFeatures(List<Feature> features) { this.features = features; }

    public static class Feature {
        private String type = "Feature";
        private Geometry geometry;
        private Map<String, Object> properties;

        public Feature() {}

        public Feature(String type, Geometry geometry, Map<String, Object> properties) {
            this.type = type;
            this.geometry = geometry;
            this.properties = properties;
        }

        public String getType() { return type; }
        public void setType(String type) { this.type = type; }
        public Geometry getGeometry() { return geometry; }
        public void setGeometry(Geometry geometry) { this.geometry = geometry; }
        public Map<String, Object> getProperties() { return properties; }
        public void setProperties(Map<String, Object> properties) { this.properties = properties; }

        public static class Geometry {
            private String type;
            private Object coordinates;

            public Geometry() {}

            public Geometry(String type, Object coordinates) {
                this.type = type;
                this.coordinates = coordinates;
            }

            public String getType() { return type; }
            public void setType(String type) { this.type = type; }
            public Object getCoordinates() { return coordinates; }
            public void setCoordinates(Object coordinates) { this.coordinates = coordinates; }
        }
    }
}