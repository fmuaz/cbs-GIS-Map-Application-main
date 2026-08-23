package com.staj.cbs_harita_app.model;

import lombok.Setter;
import java.util.List;
import java.util.Map;

@Setter
public class GeoJsonModel {
    private String type="FeatureCollection";
    private List<Feature> features;

    public GeoJsonModel(){
    }

    public String getType(){
        return type;
    }
    public List<Feature> getFeatures(){
        return this.features;
    }

    @Setter
    public static class Feature{
        private String type="Feature";
        private Geometry geometry;
        private Map<String, Object> properties;

        public Feature(){
        }

        public Feature(String type, Geometry geometry, Map<String, Object> properties) {
            this.type = type;
            this.geometry = geometry;
            this.properties = properties;
        }

        public String getType(){
            return this.type;
        }

        public Geometry getGeometry() {
            return geometry;
        }

        public Map<String, Object> getProperties(){
            return this.properties;
        }

        @Setter
        public static class Geometry{
            private String type;
            private Object coordinates;

            public Geometry(){
            }

            public Geometry(String type, Object coordinates) {
                this.type = type;
                this.coordinates = coordinates;
            }

            public String getType(){
                return this.type;
            }
            public Object getCoordinates(){
                return this.coordinates;
            }
        }

    }


}
