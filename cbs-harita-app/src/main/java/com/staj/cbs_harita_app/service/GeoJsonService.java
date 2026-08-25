package com.staj.cbs_harita_app.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.staj.cbs_harita_app.model.GeoJsonModel;
import com.staj.cbs_harita_app.model.MeasurementEntity;
import com.staj.cbs_harita_app.repository.MeasurementRepository;
import org.locationtech.jts.geom.Coordinate;
import org.locationtech.jts.geom.Geometry;
import org.locationtech.jts.geom.GeometryFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.Arrays;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
public class GeoJsonService {

    private final ObjectMapper objectMapper = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    @Value("${map.data.path}")
    private String directoryPath;

    private final MeasurementRepository repository;
    private final GeometryFactory geometryFactory = new GeometryFactory();

    @Autowired
    public GeoJsonService(MeasurementRepository repository) {
        this.repository = repository;
    }

    public GeoJsonModel getGeoJsonModel(String fileName) throws Exception {
        if (fileName.contains("..")) throw new SecurityException("Zafiyet algılandı!");
        String filePath = directoryPath + "/" + fileName;
        File file = new File(filePath);
        if (!file.exists()) throw new FileNotFoundException("Dosya bulunamadı: " + filePath);
        if (file.length() == 0) throw new IllegalArgumentException("Dosyanın içi boş");

        try (Reader reader = new InputStreamReader(new FileInputStream(file), StandardCharsets.UTF_8)) {
            return objectMapper.readValue(reader, GeoJsonModel.class);
        } catch (IOException e) {
            throw new IOException("JSON verisi modele dönüştürülürken hata oluştu..." + e.getMessage());
        }
    }

    public String getDirectoryPath() { return this.directoryPath; }

    public void saveFile(MultipartFile file) throws Exception {
        if (file.isEmpty()) throw new IllegalArgumentException("Boş dosya yüklenemez.");
        File directory = new File(directoryPath);
        if (!directory.exists()) throw new FileNotFoundException("Klasör bulunamadı.");
        String fileName = file.getOriginalFilename();
        if (fileName == null || fileName.contains("..")) throw new SecurityException("Zafiyet algılandı!");
        Path path = Paths.get(directoryPath + "/" + fileName);
        Files.write(path, file.getBytes());
    }

    public List<String> getAllGeoJsonFiles() {
        File dir = new File(directoryPath);
        if (!dir.exists() || !dir.isDirectory()) return List.of();
        File[] files = dir.listFiles((d, name) -> name.toLowerCase().endsWith(".json") || name.toLowerCase().endsWith(".geojson"));
        if (files == null) return List.of();
        return Arrays.stream(files).map(File::getName).collect(Collectors.toList());
    }

    public String saveMeasurementData(String geoJsonData) throws Exception {
        JsonNode rootNode = objectMapper.readTree(geoJsonData);
        JsonNode features = rootNode.path("features");

        int savedCount = 0;

        if (features.isArray()) {
            for (JsonNode featureNode : features) {
                MeasurementEntity entity = new MeasurementEntity();

                JsonNode geometryNode = featureNode.path("geometry");
                if (!geometryNode.isMissingNode() && !geometryNode.isNull()) {
                    String type = geometryNode.path("type").asText();
                    JsonNode coordsNode = geometryNode.path("coordinates");

                    Geometry geometry = parseGeometry(type, coordsNode);
                    if (geometry != null) {
                        geometry.setSRID(4326);
                        entity.setGeometry(geometry);
                        entity.setGeometryType(geometry.getGeometryType());
                    }
                }

                JsonNode propertiesNode = featureNode.path("properties");
                if (!propertiesNode.isMissingNode() && !propertiesNode.isNull()) {
                    @SuppressWarnings("unchecked")
                    Map<String, Object> propertiesMap = objectMapper.convertValue(propertiesNode, Map.class);
                    entity.setProperties(propertiesMap);

                    if (propertiesMap.containsKey("exportId")) {
                        entity.setExportId(Integer.parseInt(propertiesMap.get("exportId").toString()));
                    }
                    if (propertiesMap.containsKey("creator")) {
                        entity.setCreator(propertiesMap.get("creator").toString());
                    }
                }

                repository.save(entity);
                savedCount++;
            }
        }

        return savedCount + " adet çizim/ölçüm doğrudan veritabanına (PostGIS) kaydedildi! 🚀";
    }

    // Veritabanındaki kayıtlı ölçüm gruplarının listesini döner (Sidebar'da listeletmek için)
    public List<Integer> getAllMeasurementExportIds() {
        return repository.findAll().stream()
                .map(MeasurementEntity::getExportId)
                .filter(java.util.Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
    }

    // Belirli bir exportId'ye ait verileri veritabanından çekip GeoJSON modeline çevirir
    public GeoJsonModel getMeasurementByExportId(Integer exportId) throws Exception {
        List<MeasurementEntity> entities = repository.findByExportId(exportId);

        GeoJsonModel model = new GeoJsonModel();
        List<GeoJsonModel.Feature> features = new java.util.ArrayList<>();

        for (MeasurementEntity entity : entities) {
            GeoJsonModel.Feature feature = new GeoJsonModel.Feature();
            feature.setType("Feature");

            if (entity.getGeometry() != null) {
                GeoJsonModel.Feature.Geometry geometry = new GeoJsonModel.Feature.Geometry();
                geometry.setType(entity.getGeometry().getGeometryType());

                org.locationtech.jts.geom.Geometry geom = entity.getGeometry();
                if ("Point".equalsIgnoreCase(geom.getGeometryType())) {
                    geometry.setCoordinates(new double[]{geom.getCoordinate().x, geom.getCoordinate().y});
                } else {
                    org.locationtech.jts.geom.Coordinate[] coords = geom.getCoordinates();
                    double[][] coordArray = new double[coords.length][2];
                    for (int i = 0; i < coords.length; i++) {
                        coordArray[i][0] = coords[i].x;
                        coordArray[i][1] = coords[i].y;
                    }
                    if ("Polygon".equalsIgnoreCase(geom.getGeometryType())) {
                        geometry.setCoordinates(new double[][][]{coordArray});
                    } else {
                        geometry.setCoordinates(coordArray);
                    }
                }
                feature.setGeometry(geometry);
            }

            if (entity.getProperties() != null) {
                feature.setProperties(entity.getProperties());
            }

            features.add(feature);
        }

        model.setFeatures(features);
        return model;
    }

    private Geometry parseGeometry(String type, JsonNode coordsNode) {
        try {
            if ("Point".equalsIgnoreCase(type)) {
                double lng = coordsNode.get(0).asDouble();
                double lat = coordsNode.get(1).asDouble();
                return geometryFactory.createPoint(new Coordinate(lng, lat));
            }
            else if ("LineString".equalsIgnoreCase(type)) {
                Coordinate[] coords = new Coordinate[coordsNode.size()];
                for (int i = 0; i < coordsNode.size(); i++) {
                    double lng = coordsNode.get(i).get(0).asDouble();
                    double lat = coordsNode.get(i).get(1).asDouble();
                    coords[i] = new Coordinate(lng, lat);
                }
                return geometryFactory.createLineString(coords);
            }
            else if ("Polygon".equalsIgnoreCase(type)) {
                JsonNode ringNode = coordsNode.get(0);
                Coordinate[] coords = new Coordinate[ringNode.size()];
                for (int i = 0; i < ringNode.size(); i++) {
                    double lng = ringNode.get(i).get(0).asDouble();
                    double lat = ringNode.get(i).get(1).asDouble();
                    coords[i] = new Coordinate(lng, lat);
                }
                return geometryFactory.createPolygon(coords);
            }
        } catch (Exception e) {
            System.err.println("Geometri çözümlenirken hata oluştu: " + e.getMessage());
        }
        return null;
    }
}